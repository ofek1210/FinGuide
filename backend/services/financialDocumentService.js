const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { promisify } = require('util');
const { randomUUID } = require('crypto');
const Document = require('../models/Document');
const { extractPayslipFile } = require('./payslipOcr');
const { validatePayslipAnalysis, buildFieldsMeta } = require('../schemas/payslipAnalysis.schema');
const { normalizeDocumentMetadataInput } = require('../utils/documentMetadata');
const { PdfPasswordRequiredError, isPdfPasswordError } = require('../utils/pdfPassword');
const { parseHarHaBituach } = require('./harHaBituachService');
const { isForm106, parseForm106Text } = require('./form106Service');

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
    const { generateAndSaveDigest } = require('./digestService');

    notificationService.notifyDocumentProcessed(userId, document).catch(() => {});
    runFullAnalysis(userId)
      .then(() => runRecommendations(userId))
      .catch(err => console.error('[documents] post-upload analysis failed', err));

    // Generate AI digest non-blocking — fails silently if no API key
    generateAndSaveDigest(userId, document).catch(() => {});
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

const applyExtractionToDocument = async (document, { password, userId } = {}) => {
  try {
    const { data } = await extractPayslipFile(document.filePath, { password });

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
      // Auto-upgrade category: if OCR found payslip data, override 'other'
      if (!document.metadata) document.metadata = {};
      if (!document.metadata.category || document.metadata.category === 'other') {
        document.metadata.category = 'payslip';
      }
    } else {
      document.status = 'needs_review';
      document.processingError = validation.message;
    }
    await document.save();

    if (userId && document.status === 'completed') {
      runPostUploadSideEffects(userId, document);
    }

    return { document, validation };
  } catch (extractionError) {
    if (
      extractionError instanceof PdfPasswordRequiredError ||
      extractionError?.code === 'PDF_PASSWORD_REQUIRED' ||
      isPdfPasswordError(extractionError)
    ) {
      document.status = 'needs_password';
      document.processingError = password
        ? 'הסיסמה שגויה או לא פותחת את הקובץ'
        : extractionError.message || 'נדרשת סיסמה לפתיחת קובץ ה-PDF';
      document.processedAt = new Date();
      await document.save();
      return { document, passwordRequired: true };
    }

    console.error('❌ Document extraction failed for document', document._id, extractionError);
    document.status = 'failed';
    document.processingError = extractionError.message;
    document.processedAt = new Date();
    await document.save().catch(() => {});
    return { document, failed: true };
  }
};

/**
 * Process an XLSX הר הביטוח file — no OCR, direct structured parse.
 */
const applyHarHaBituachExtraction = async (document, { userId } = {}) => {
  try {
    const data = parseHarHaBituach(document.filePath);
    document.analysisData = data;
    document.processedAt = new Date();
    document.status = 'completed';
    document.processingError = null;
    if (!document.metadata) document.metadata = {};
    document.metadata.category = 'other'; // HB is not a payslip
    await document.save();
    if (userId) runPostUploadSideEffects(userId, document);
    return { document, validation: { ok: true } };
  } catch (err) {
    console.error('❌ HB XLSX parse failed', document._id, err);
    document.status = 'failed';
    document.processingError = err.message;
    document.processedAt = new Date();
    await document.save().catch(() => {});
    return { document, failed: true };
  }
};

/**
 * Process a Form 106 (annual tax certificate) PDF.
 */
const applyForm106Extraction = async (document, text, { userId } = {}) => {
  try {
    const data = parseForm106Text(text);
    document.analysisData = data;
    document.processedAt = new Date();
    document.status = 'completed';
    document.processingError = null;
    if (!document.metadata) document.metadata = {};
    document.metadata.category = 'form_106';
    await document.save();
    if (userId) runPostUploadSideEffects(userId, document);
    return { document, validation: { ok: true } };
  } catch (err) {
    console.error('❌ Form 106 parse failed', document._id, err);
    document.status = 'failed';
    document.processingError = err.message;
    document.processedAt = new Date();
    await document.save().catch(() => {});
    return { document, failed: true };
  }
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
  const ext = path.extname(originalName || filePath).toLowerCase();
  const isXlsx = ext === '.xlsx' || ext === '.xls';

  const document = await Document.create({
    user: userId,
    originalName,
    filename,
    filePath,
    fileSize: stats.size,
    mimeType: isXlsx
      ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      : 'application/pdf',
    metadata: documentMetadata,
    checksumSha256,
    status: 'pending',
    source,
    ...(emailMetadata && { emailMetadata }),
  });

  document.status = 'processing';
  await document.save();

  // For PDFs: check if it's a Form 106 before running payslip OCR
  let result;
  if (isXlsx) {
    result = await applyHarHaBituachExtraction(document, { userId });
  } else {
    // Peek at PDF text to detect Form 106
    let pdfText = '';
    try {
      const { execFile } = require('child_process');
      const { promisify: p } = require('util');
      const execFileAsync = p(execFile);
      const { stdout } = await execFileAsync('pdftotext', ['-layout', document.filePath, '-']);
      pdfText = stdout || '';
    } catch (_) { /* pdftotext unavailable, fall through */ }

    if (isForm106(pdfText)) {
      result = await applyForm106Extraction(document, pdfText, { userId });
    } else {
      result = await applyExtractionToDocument(document, { userId });
    }
  }

  // eslint-disable-next-line no-console
  console.log('[documents] processFinancialDocument extraction result', {
    documentId: document._id,
    source,
    status: result.document.status,
    ...(result.validation?.ok === false ? { validation_reason: result.validation.reason } : {}),
  });

  return result.document;
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

/**
 * Re-process an existing document, routing to the right extractor based on type.
 * Used by the reprocess endpoint so Form 106 isn't sent through payslip OCR.
 */
const smartReprocessDocument = async (document, { userId } = {}) => {
  const ext = path.extname(document.originalName || document.filePath || '').toLowerCase();
  const isXlsx = ext === '.xlsx' || ext === '.xls';

  if (isXlsx) {
    return applyHarHaBituachExtraction(document, { userId });
  }

  // Detect Form 106 via pdftotext
  let pdfText = '';
  try {
    const { execFile } = require('child_process');
    const { promisify: p } = require('util');
    const execFileAsync = p(execFile);
    const { stdout } = await execFileAsync('pdftotext', ['-layout', document.filePath, '-']);
    pdfText = stdout || '';
  } catch (_) { /* fallthrough */ }

  if (isForm106(pdfText)) {
    return applyForm106Extraction(document, pdfText, { userId });
  }

  return applyExtractionToDocument(document, { userId });
};

module.exports = {
  computeFileChecksum,
  applyExtractionToDocument,
  processFinancialDocument,
  smartReprocessDocument,
  saveIncomingPdfToUploads,
  removeFileQuietly,
  runPostUploadSideEffects,
};
