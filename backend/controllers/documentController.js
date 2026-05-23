const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { promisify } = require('util');
const Document = require('../models/Document');
const { FileUploadError, NotFoundError } = require('../utils/appErrors');
const { normalizeDocumentMetadataInput } = require('../utils/documentMetadata');
const { serializeDocument } = require('../serializers/documentSerializer');
const { extractPayslipFile } = require('../services/payslipOcr');
const {
  extractPayslipFields,
  validatePayslipExtraction,
} = require('../services/extraction-v2');
const { serializeDocument } = require('../serializers/documentSerializer');
const { buildPayslipHistoryIntelligence } = require('../services/payslipHistoryAggregationService');

const unlink = promisify(fs.unlink);

const toRawLinesFallback = rawText => String(rawText || '')
  .split(/\r?\n/)
  .map(line => line.trim())
  .filter(Boolean);

const normalizeRawLinesForV2 = (rawLines, rawText) => {
  if (Array.isArray(rawLines) && rawLines.length > 0) {
    const cleaned = rawLines
      .map(line => (line == null ? '' : String(line).trim()))
      .filter(Boolean);
    if (cleaned.length > 0) {
      return cleaned;
    }
  }
  return toRawLinesFallback(rawText);
};

const applyExtractorV2Shadow = async analysisData => {
  if (!analysisData || typeof analysisData !== 'object') {
    return analysisData;
  }

  const data = { ...analysisData };
  const rawText = data.raw?.rawText || data.raw?.ocr_text || '';
  const rawLines = normalizeRawLinesForV2(data.raw?.rawLines, rawText);
  const extractionMethod = data.raw?.extractionMethod || null;

  if (!rawText || !String(rawText).trim()) {
    return analysisData;
  }

  data.pipeline_version = 'extractor-v2-shadow';
  data.quality = data.quality && typeof data.quality === 'object' ? data.quality : {};
  data.quality.warnings = Array.isArray(data.quality.warnings) ? data.quality.warnings : [];
  data.quality.debug = data.quality.debug && typeof data.quality.debug === 'object'
    ? data.quality.debug
    : {};

  try {
    const extractionResult = await extractPayslipFields({
      rawText,
      rawLines,
      extractionMethod,
      rawPayload: data.raw || {},
    });
    const validationResult = validatePayslipExtraction({ extractionResult });

    data.extraction_v2 = extractionResult;
    data.quality.validation = validationResult;
    data.quality.debug.extraction_v2_shadow = {
      status: 'ok',
      rawLinesCount: rawLines.length,
      extracted_field_count: Object.keys(extractionResult.fields || {}).length,
      extracted_field_keys: Object.keys(extractionResult.fields || {}),
      amount_logic: extractionResult.meta?.debug?.amountExtraction || null,
    };
  } catch (error) {
    data.quality.warnings.push('[extractor-v2-shadow] v2 extraction failed; legacy output kept.');
    data.quality.debug.extraction_v2_shadow = {
      status: 'failed',
      rawLinesCount: rawLines.length,
      error: error?.message || 'unknown extractor-v2 error',
    };
  }

  return data;
};

const computeFileChecksum = filePath =>
  new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);

    stream.on('error', reject);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });

// העלאת מסמך
exports.uploadDocument = async (req, res, next) => {
  try {
    if (!req.file) {
      return next(new FileUploadError('לא נבחר קובץ'));
    }

    const metadata = normalizeDocumentMetadataInput(req.body);
    const checksumSha256 = await computeFileChecksum(req.file.path);

    // יצירת רשומה במונגו
    const document = await Document.create({
      user: req.user.id,
      originalName: req.file.originalname,
      filename: req.file.filename,
      filePath: req.file.path,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      metadata,
      checksumSha256,
      status: 'pending',
    });

    // ניסיון לבצע חילוץ טקסט ו-OCR (אם יש צורך) ולחלץ נתונים מהתלוש
    try {
      const { data } = await extractPayslipFile(req.file.path);
      const shadowData = await applyExtractorV2Shadow(data);

      document.analysisData = shadowData;
      document.status = 'completed';
      document.processedAt = new Date();
      await document.save();
      // eslint-disable-next-line no-console
      console.log('[documents] uploadDocument extraction result', {
        documentId: document._id,
        summary: document.analysisData?.summary,
      });
    } catch (ocrError) {
      console.error('❌ Document extraction failed for document', document._id, ocrError);
      document.status = 'failed';
      await document.save().catch(() => {});
    }

    const responseBody = {
      success: true,
      data: serializeDocument(document),
    };
    res.status(201).json(responseBody);
  } catch (error) {
    // אם נכשל, מחק את הקובץ
    if (req.file) {
      await unlink(req.file.path).catch(err => console.error(err));
    }
    next(error);
  }
};

// קבלת כל המסמכים של משתמש
exports.getDocuments = async (req, res, next) => {
  try {
    const filter = { user: req.user.id };

    const documents = await Document.find(filter).sort('-uploadedAt');

    const responseBody = {
      success: true,
      count: documents.length,
      data: documents.map(serializeDocument),
    };
    res.status(200).json(responseBody);
  } catch (error) {
    next(error);
  }
};

exports.getPayslipHistory = async (req, res, next) => {
  try {
    const documents = await Document.find({ user: req.user.id }).sort('-uploadedAt').lean();
    const intelligence = buildPayslipHistoryIntelligence(documents, { year: req.query.year });

    res.status(200).json({
      success: true,
      data: intelligence,
    });
  } catch (error) {
    next(error);
  }
};

// קבלת מסמך בודד
exports.getDocument = async (req, res, next) => {
  try {
    const document = await Document.findOne({
      _id: req.params.id,
      user: req.user.id,
    });

    if (!document) {
      return next(new NotFoundError('מסמך לא נמצא'));
    }

    const responseBody = {
      success: true,
      data: serializeDocument(document),
    };
    res.status(200).json(responseBody);
  } catch (error) {
    next(error);
  }
};

// מחיקת מסמך
exports.deleteDocument = async (req, res, next) => {
  try {
    const document = await Document.findOne({
      _id: req.params.id,
      user: req.user.id,
    });

    if (!document) {
      return next(new NotFoundError('מסמך לא נמצא'));
    }

    // מחיקת הקובץ מהדיסק
    await unlink(document.filePath).catch(err => {
      console.error('שגיאה במחיקת קובץ:', err);
    });

    // מחיקה מהמסד נתונים
    await document.deleteOne();

    res.status(200).json({
      success: true,
      message: 'המסמך נמחק בהצלחה',
    });
  } catch (error) {
    next(error);
  }
};

// הורדת מסמך
exports.downloadDocument = async (req, res, next) => {
  try {
    const document = await Document.findOne({
      _id: req.params.id,
      user: req.user.id,
    });

    if (!document) {
      return next(new NotFoundError('מסמך לא נמצא'));
    }

    // Prevent path traversal — ensure filePath is within uploads dir
    const uploadsDir = path.resolve(process.cwd(), 'uploads');
    const resolvedPath = path.resolve(document.filePath);
    if (!resolvedPath.startsWith(uploadsDir)) {
      return next(new NotFoundError('מסמך לא נמצא'));
    }

    // שליחת הקובץ
    res.download(document.filePath, document.originalName);
  } catch (error) {
    next(error);
  }
};
