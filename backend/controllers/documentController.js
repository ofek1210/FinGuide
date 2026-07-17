const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const Document = require('../models/Document');
const { FileUploadError, NotFoundError, ValidationError } = require('../utils/appErrors');
const { serializeDocument } = require('../serializers/documentSerializer');
const { buildPayslipHistoryIntelligence } = require('../services/payslipHistoryAggregationService');
const { selectRecentPayslipDocuments } = require('../utils/selectRecentPayslipDocuments');
const {
  computeFileChecksum,
  applyExtractionToDocument,
  smartReprocessDocument,
  processFinancialDocument,
} = require('../services/financialDocumentService');

const unlink = promisify(fs.unlink);

function uploadOutcomeFromStatus(status) {
  if (status === 'completed' || status === 'needs_review') return 'analyzed';
  if (status === 'needs_password') return 'needs_password';
  return 'failed';
}

function enrichUploadResponse(serialized) {
  const analyzable = serialized.status === 'completed' || serialized.status === 'needs_review';
  return {
    ...serialized,
    analyzable,
    uploadOutcome: uploadOutcomeFromStatus(serialized.status),
  };
}

// העלאת מסמך
exports.uploadDocument = async (req, res, next) => {
  try {
    if (!req.file) {
      return next(new FileUploadError('לא נבחר קובץ'));
    }

    const checksumSha256 = await computeFileChecksum(req.file.path);

    const result = await processFinancialDocument({
      userId: req.user.id,
      filePath: req.file.path,
      originalName: req.file.originalname,
      source: 'manual',
      metadata: req.body,
      checksumSha256,
    });

    if (result?.routedTo) {
      return res.status(201).json({
        success: true,
        routedTo: result.routedTo,
        message: result.message,
        data: result.data,
      });
    }

    const responseBody = {
      success: true,
      data: enrichUploadResponse(serializeDocument(result)),
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

exports.getRecentPayslips = async (req, res, next) => {
  try {
    const rawLimit = Number(req.query.limit);
    const limit = Number.isFinite(rawLimit) && rawLimit <= 0
      ? 0
      : Math.min(Math.max(rawLimit || 3, 1), 60);
    const documents = await Document.find({
      user: req.user.id,
      status: { $in: ['completed', 'needs_review'] },
      analysisData: { $exists: true, $ne: null },
    })
      .sort('-uploadedAt')
      .limit(50)
      .lean();

    const recent = selectRecentPayslipDocuments(documents, limit);

    res.status(200).json({
      success: true,
      count: recent.length,
      data: {
        documents: recent.map(serializeDocument),
        count: recent.length,
      },
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

    await smartReprocessDocument(document, { userId: req.user.id });

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

// PATCH /api/documents/:id/fields - manually fill fields the OCR could not extract.
// Accepts a flat `fields` object and merges the provided values into the
// canonical analysisData shape the frontend reads.
exports.updateDocumentFields = async (req, res, next) => {
  try {
    const document = await Document.findOne({
      _id: req.params.id,
      user: req.user.id,
    });
    if (!document) {
      return next(new NotFoundError('מסמך לא נמצא'));
    }

    const fields = req.body && typeof req.body.fields === 'object' ? req.body.fields : null;
    if (!fields) {
      return next(new ValidationError('שדות לא תקינים', [{ field: 'fields', message: 'Must be an object' }]));
    }

    const text = value => (typeof value === 'string' && value.trim() ? value.trim() : undefined);
    const num = value => {
      if (value == null || value === '') return undefined;
      const n = Number(String(value).replace(/,/g, ''));
      return Number.isFinite(n) ? n : undefined;
    };

    const analysis = (document.analysisData && typeof document.analysisData === 'object')
      ? { ...document.analysisData }
      : {};
    analysis.period = { ...(analysis.period || {}) };
    analysis.salary = { ...(analysis.salary || {}) };
    analysis.parties = { ...(analysis.parties || {}) };
    analysis.summary = { ...(analysis.summary || {}) };

    const set = (obj, key, value) => { if (value !== undefined) obj[key] = value; };
    set(analysis.period, 'month', text(fields.periodMonth));
    set(analysis.parties, 'employer_name', text(fields.employerName));
    set(analysis.parties, 'employee_name', text(fields.employeeName));
    set(analysis.parties, 'employee_id', text(fields.employeeId));
    set(analysis.summary, 'date', text(fields.paymentDate));
    set(analysis.salary, 'gross_total', num(fields.grossSalary));
    set(analysis.salary, 'net_payable', num(fields.netSalary));

    analysis.manuallyEdited = true;
    analysis.manuallyEditedAt = new Date().toISOString();

    document.analysisData = analysis;
    document.markModified('analysisData');
    if (document.status === 'needs_review' || document.status === 'failed') {
      document.status = 'completed';
    }
    await document.save();

    return res.status(200).json({
      success: true,
      data: serializeDocument(document),
    });
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

// DELETE /api/documents/all — remove every document (and file) for the user
exports.deleteAllDocuments = async (req, res, next) => {
  try {
    const documents = await Document.find({ user: req.user.id });
    await Promise.all(
      documents.map(doc =>
        unlink(doc.filePath).catch(err => console.error('שגיאה במחיקת קובץ:', err)),
      ),
    );
    const result = await Document.deleteMany({ user: req.user.id });
    res.status(200).json({
      success: true,
      message: 'כל המסמכים נמחקו בהצלחה',
      deletedCount: result.deletedCount,
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

// GET /api/documents/:id/digest — returns AI-generated digest for a payslip
exports.getDocumentDigest = async (req, res, next) => {
  try {
    const document = await Document.findOne({
      _id: req.params.id,
      user: req.user.id,
    }).select('status digest').lean();

    if (!document) {
      return next(new NotFoundError('מסמך לא נמצא'));
    }

    if (document.status !== 'completed') {
      return res.status(202).json({ success: false, message: 'המסמך עדיין בעיבוד.' });
    }

    if (!document.digest?.text) {
      return res.status(202).json({ success: false, message: 'הסיכום AI טרם נוצר.' });
    }

    return res.json({
      success: true,
      data: {
        text: document.digest.text,
        generatedAt: document.digest.generatedAt,
        model: document.digest.model,
      },
    });
  } catch (error) {
    next(error);
  }
};
