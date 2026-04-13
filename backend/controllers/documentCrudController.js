const fs = require('fs');
const { promisify } = require('util');
const Document = require('../models/Document');
const { NotFoundError } = require('../utils/appErrors');
const { serializeDocument } = require('../serializers/documentSerializer');
const { removeOcrDebugArtifact } = require('../services/ocrDebugArtifactService');

const unlink = promisify(fs.unlink);

const logDocumentEvent = (level, message, meta = {}) => {
  const logger = level === 'error' ? console.error : console.log;
  logger('[documents]', {
    level,
    message,
    ...meta,
  });
};

exports.getDocuments = async (req, res, next) => {
  try {
    const documents = await Document.find({ user: req.user.id }).sort('-uploadedAt');

    res.status(200).json({
      success: true,
      count: documents.length,
      data: documents.map(serializeDocument),
    });
  } catch (error) {
    next(error);
  }
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

    return res.status(200).json({
      success: true,
      data: serializeDocument(document),
    });
  } catch (error) {
    return next(error);
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

    await unlink(document.filePath).catch(error => {
      logDocumentEvent('error', 'file_delete_failed', {
        documentId: document._id.toString(),
        errorType: error?.name || 'Error',
      });
    });
    await removeOcrDebugArtifact(document.ocrDebugArtifactPath);
    await document.deleteOne();

    return res.status(200).json({
      success: true,
      message: 'המסמך נמחק בהצלחה',
    });
  } catch (error) {
    return next(error);
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

    return res.download(document.filePath, document.originalName);
  } catch (error) {
    return next(error);
  }
};
