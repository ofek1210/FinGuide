const fs = require('fs');
const crypto = require('crypto');
const { promisify } = require('util');
const Document = require('../models/Document');
const { FileUploadError, NotFoundError } = require('../utils/appErrors');
const { normalizeDocumentMetadataInput } = require('../utils/documentMetadata');
const { serializeDocument } = require('../serializers/documentSerializer');
const { requestDocumentProcessing } = require('../services/documentProcessingService');
const { removeOcrDebugArtifact } = require('../services/ocrDebugArtifactService');

const unlink = promisify(fs.unlink);

const computeFileChecksum = filePath =>
  new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);

    stream.on('error', reject);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });

exports.uploadDocument = async (req, res, next) => {
  try {
    if (!req.file) {
      return next(new FileUploadError('לא נבחר קובץ'));
    }

    const metadata = normalizeDocumentMetadataInput(req.body);
    const checksumSha256 = await computeFileChecksum(req.file.path);

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
      processingStage: 'queued',
    });

    return res.status(201).json({
      success: true,
      data: serializeDocument(document),
    });
  } catch (error) {
    if (req.file) {
      await unlink(req.file.path).catch(() => {});
    }
    return next(error);
  }
};

exports.retryDocumentProcessing = async (req, res, next) => {
  try {
    const document = await Document.findOne({
      _id: req.params.id,
      user: req.user.id,
    });

    if (!document) {
      return next(new NotFoundError('מסמך לא נמצא'));
    }

    if (document.status === 'processing') {
      return res.status(409).json({
        success: false,
        message: 'המסמך כבר נמצא בעיבוד',
      });
    }

    await removeOcrDebugArtifact(document.ocrDebugArtifactPath);

    const queuedDocument = await requestDocumentProcessing(document._id.toString(), {
      force: true,
    });
    const responseDocument = queuedDocument || Object.assign(document, {
      status: 'pending',
      processingStage: 'queued',
      processingError: null,
    });

    return res.status(202).json({
      success: true,
      data: serializeDocument(responseDocument),
    });
  } catch (error) {
    return next(error);
  }
};
