const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const Document = require('../models/Document');
const { FileUploadError, NotFoundError, ValidationError } = require('../utils/appErrors');
const { serializeDocument } = require('../serializers/documentSerializer');
const { buildPayslipHistoryIntelligence } = require('../services/payslipHistoryAggregationService');
const {
  computeFileChecksum,
  applyExtractionToDocument,
  processFinancialDocument,
} = require('../services/financialDocumentService');

const unlink = promisify(fs.unlink);

// העלאת מסמך
exports.uploadDocument = async (req, res, next) => {
  try {
    if (!req.file) {
      return next(new FileUploadError('לא נבחר קובץ'));
    }

    const checksumSha256 = await computeFileChecksum(req.file.path);

    const document = await processFinancialDocument({
      userId: req.user.id,
      filePath: req.file.path,
      originalName: req.file.originalname,
      source: 'manual',
      metadata: req.body,
      checksumSha256,
    });

    const responseBody = {
      success: true,
      data: serializeDocument(document),
    };
    res.status(201).json(responseBody);
  } catch (error) {
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
exports.reprocessDocument = async (req, res, next) => {
  try {
    const document = await findOwnedDocumentWithFile(req);

    document.status = 'processing';
    document.processingError = null;
    await document.save();

    await applyExtractionToDocument(document, { userId: req.user.id });

    res.status(200).json({
      success: true,
      data: serializeDocument(document),
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/documents/:id/unlock - supply PDF password and continue extraction.
exports.unlockDocument = async (req, res, next) => {
  try {
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!password.trim()) {
      return next(
        new ValidationError('שגיאות בולידציה', [
          { field: 'password', message: 'נא להזין סיסמת PDF', value: req.body?.password },
        ])
      );
    }

    const document = await findOwnedDocumentWithFile(req);
    if (document.status !== 'needs_password') {
      return next(
        new ValidationError('שגיאות בולידציה', [
          {
            field: 'status',
            message: 'המסמך אינו ממתין לסיסמה',
            value: document.status,
          },
        ])
      );
    }

    document.status = 'processing';
    document.processingError = null;
    await document.save();

    const result = await applyExtractionToDocument(document, {
      password: password.trim(),
      userId: req.user.id,
    });

    if (result.passwordRequired) {
      return res.status(400).json({
        success: false,
        message: 'הסיסמה שגויה או לא פותחת את הקובץ. נסו שוב.',
        data: serializeDocument(result.document),
      });
    }

    res.status(200).json({
      success: true,
      data: serializeDocument(result.document),
    });
  } catch (error) {
    next(error);
  }
};

const findOwnedDocumentWithFile = async req => {
  const document = await Document.findOne({
    _id: req.params.id,
    user: req.user.id,
  });

  if (!document) {
    throw new NotFoundError('מסמך לא נמצא');
  }
  if (!document.filePath) {
    throw new NotFoundError('הקובץ המקורי לא קיים יותר — לא ניתן להריץ חילוץ מחדש');
  }

  const uploadsDir = path.resolve(process.cwd(), 'uploads');
  const resolvedPath = path.resolve(document.filePath);
  if (!resolvedPath.startsWith(uploadsDir)) {
    throw new NotFoundError('מסמך לא נמצא');
  }

  return document;
};

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

exports.deleteDocument = async (req, res, next) => {
  try {
    const document = await Document.findOne({
      _id: req.params.id,
      user: req.user.id,
    });

    if (!document) {
      return next(new NotFoundError('מסמך לא נמצא'));
    }

    await unlink(document.filePath).catch(err => {
      console.error('שגיאה במחיקת קובץ:', err);
    });

    await document.deleteOne();

    res.status(200).json({
      success: true,
      message: 'המסמך נמחק בהצלחה',
    });
  } catch (error) {
    next(error);
  }
};

exports.downloadDocument = async (req, res, next) => {
  try {
    const document = await Document.findOne({
      _id: req.params.id,
      user: req.user.id,
    });

    if (!document) {
      return next(new NotFoundError('מסמך לא נמצא'));
    }

    const uploadsDir = path.resolve(process.cwd(), 'uploads');
    const resolvedPath = path.resolve(document.filePath);
    if (!resolvedPath.startsWith(uploadsDir)) {
      return next(new NotFoundError('מסמך לא נמצא'));
    }

    res.download(document.filePath, document.originalName);
  } catch (error) {
    next(error);
  }
};
