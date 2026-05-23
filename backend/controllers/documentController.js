const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { promisify } = require('util');
const Document = require('../models/Document');
const { FileUploadError, NotFoundError } = require('../utils/appErrors');
const { normalizeDocumentMetadataInput } = require('../utils/documentMetadata');
const { serializeDocument } = require('../serializers/documentSerializer');
const { extractPayslipFile } = require('../services/payslipOcr');
const { serializeDocument } = require('../serializers/documentSerializer');
const { validatePayslipAnalysis, buildFieldsMeta } = require('../schemas/payslipAnalysis.schema');
const { buildPayslipHistoryIntelligence } = require('../services/payslipHistoryAggregationService');

const unlink = promisify(fs.unlink);

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

      // Lift per-field confidence/source so the frontend can read it without
      // walking the resolver-specific quality contract.
      const fieldsMeta = buildFieldsMeta(data);
      if (fieldsMeta) {
        data.fields_meta = fieldsMeta;
      }

      // Schema gate: if any of the critical fields (period.month, gross_total,
      // net_payable, mandatory.total) are missing or fail cross-field sanity,
      // flag the document for human review instead of presenting it as complete.
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
      console.log('[documents] uploadDocument extraction result', {
        documentId: document._id,
        status: document.status,
        summary: document.analysisData?.summary,
        ...(validation.ok ? {} : { validation_reason: validation.reason }),
      });
    } catch (ocrError) {
      console.error('❌ Document extraction failed for document', document._id, ocrError);
      document.status = 'failed';
      document.processingError = ocrError.message;
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

// POST /api/documents/:id/reprocess - run extraction again on the existing PDF.
// Lets the user re-extract a payslip after a pipeline upgrade (e.g. the
// net_payable bug fix) without having to re-upload the file.
exports.reprocessDocument = async (req, res, next) => {
  try {
    const document = await Document.findOne({
      _id: req.params.id,
      user: req.user.id,
    });

    if (!document) {
      return next(new NotFoundError('מסמך לא נמצא'));
    }
    if (!document.filePath) {
      return next(new NotFoundError('הקובץ המקורי לא קיים יותר — לא ניתן להריץ חילוץ מחדש'));
    }

    // Path-traversal guard: same posture as downloadDocument.
    const uploadsDir = path.resolve(process.cwd(), 'uploads');
    const resolvedPath = path.resolve(document.filePath);
    if (!resolvedPath.startsWith(uploadsDir)) {
      return next(new NotFoundError('מסמך לא נמצא'));
    }

    document.status = 'processing';
    document.processingError = null;
    await document.save();

    try {
      const { data } = await extractPayslipFile(document.filePath);

      const fieldsMeta = buildFieldsMeta(data);
      if (fieldsMeta) data.fields_meta = fieldsMeta;

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
    } catch (extractionError) {
      console.error('❌ Reprocess failed for document', document._id, extractionError);
      document.status = 'failed';
      document.processingError = extractionError?.message || 'Reprocess failed';
      document.processedAt = new Date();
      await document.save().catch(() => {});
    }

    res.status(200).json({
      success: true,
      data: serializeDocument(document),
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
