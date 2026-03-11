const fs = require('fs');
const crypto = require('crypto');
const { promisify } = require('util');
const Document = require('../models/Document');
const { FileUploadError, NotFoundError } = require('../utils/appErrors');
const { normalizeDocumentMetadataInput } = require('../utils/documentMetadata');
const { serializeDocument } = require('../serializers/documentSerializer');
const { processDocumentAsync } = require('../services/documentProcessingService');

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
    // eslint-disable-next-line no-console
    console.log('[documents] uploadDocument req.user =', req.user);
    // בדוק שקובץ הועלה
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

    processDocumentAsync(document._id.toString());

    const responseBody = {
      success: true,
      data: serializeDocument(document),
    };
    // eslint-disable-next-line no-console
    console.log('[documents] uploadDocument response', responseBody);
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
    const documents = await Document.find({ user: req.user.id }).sort('-uploadedAt');

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

    // שליחת הקובץ
    res.download(document.filePath, document.originalName);
  } catch (error) {
    next(error);
  }
};
