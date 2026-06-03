const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { promisify } = require('util');
const { randomUUID } = require('crypto');
const Document = require('../models/Document');
const { extractPayslipFile } = require('./payslipOcr');
const { validatePayslipAnalysis, buildFieldsMeta } = require('../schemas/payslipAnalysis.schema');
const { normalizeDocumentMetadataInput } = require('../utils/documentMetadata');

const unlink = promisify(fs.unlink);

const computeFileChecksum = filePath =>
  new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);

    stream.on('error', reject);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });

const runPostUploadSideEffects = (userId, document) => {
  setImmediate(() => {
    const notificationService = require('./notificationService');
    const { runFullAnalysis } = require('./insightsEngine');
    const { run: runRecommendations } = require('./insuranceRecommender');

    notificationService.notifyDocumentProcessed(userId, document).catch(() => {});
    runFullAnalysis(userId)
      .then(() => runRecommendations(userId))
      .catch(err => console.error('[documents] post-upload analysis failed', err));
  });
};

const resolveDocumentMetadata = (source, metadata) => {
  if (metadata !== undefined && metadata !== null) {
    const normalized = normalizeDocumentMetadataInput(metadata);
    if (source === 'gmail') {
      normalized.source = 'gmail';
      normalized.category = normalized.category || 'payslip';
    }
    return normalized;
  }

  return {
    category: source === 'gmail' ? 'payslip' : 'other',
    source: source === 'gmail' ? 'gmail' : 'manual_upload',
  };
};

/**
 * Shared pipeline for manual upload and Gmail import.
 */
const processFinancialDocument = async ({
  userId,
  filePath,
  originalName,
  source = 'manual',
  metadata,
  checksumSha256: providedChecksum,
  emailMetadata,
}) => {
  const stats = await fs.promises.stat(filePath);
  const checksumSha256 = providedChecksum || (await computeFileChecksum(filePath));
  const filename = path.basename(filePath);
  const documentMetadata = resolveDocumentMetadata(source, metadata);

  const document = await Document.create({
    user: userId,
    originalName,
    filename,
    filePath,
    fileSize: stats.size,
    mimeType: 'application/pdf',
    metadata: documentMetadata,
    checksumSha256,
    status: 'pending',
    source,
    ...(emailMetadata && { emailMetadata }),
  });

  try {
    const { data } = await extractPayslipFile(filePath);

    const fieldsMeta = buildFieldsMeta(data);
    if (fieldsMeta) {
      data.fields_meta = fieldsMeta;
    }

    const validation = validatePayslipAnalysis(data);
    document.analysisData = data;
    document.processedAt = new Date();
    if (validation.ok) {
      document.status = 'completed';
      document.processingError = null;
    } else {
      document.status = 'needs_review';
      document.processingError = validation.message;
    }
    await document.save();

    // eslint-disable-next-line no-console
    console.log('[documents] processFinancialDocument extraction result', {
      documentId: document._id,
      source,
      status: document.status,
      ...(validation.ok ? {} : { validation_reason: validation.reason }),
    });

    runPostUploadSideEffects(userId, document);
  } catch (ocrError) {
    console.error('❌ Document extraction failed for document', document._id, ocrError);
    document.status = 'failed';
    document.processingError = ocrError.message;
    await document.save().catch(() => {});
  }

  return document;
};

const saveIncomingPdfToUploads = async (buffer, originalName) => {
  const uploadsDir = path.join(process.cwd(), 'uploads');
  await fs.promises.mkdir(uploadsDir, { recursive: true });
  const filename = `${randomUUID()}.pdf`;
  const filePath = path.join(uploadsDir, filename);
  await fs.promises.writeFile(filePath, buffer);
  return { filePath, filename };
};

const removeFileQuietly = async filePath => {
  if (!filePath) return;
  await unlink(filePath).catch(err => console.error(err));
};

module.exports = {
  computeFileChecksum,
  processFinancialDocument,
  saveIncomingPdfToUploads,
  removeFileQuietly,
  runPostUploadSideEffects,
};
