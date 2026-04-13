const { getDocumentMetadata } = require('../utils/documentMetadata');

const serializeDocument = document => {
  const raw = document && typeof document.toObject === 'function'
    ? document.toObject()
    : document;

  if (!raw) {
    return null;
  }

  return {
    id: raw._id?.toString?.() || raw._id,
    originalName: raw.originalName,
    fileSize: raw.fileSize,
    mimeType: raw.mimeType,
    status: raw.status,
    processingStage: raw.processingStage || null,
    processingAttempts: Number.isFinite(raw.processingAttempts)
      ? raw.processingAttempts
      : 0,
    processingStartedAt: raw.processingStartedAt || null,
    processingFinishedAt: raw.processingFinishedAt || null,
    uploadedAt: raw.uploadedAt,
    processedAt: raw.processedAt || null,
    processingError: raw.processingError || null,
    metadata: getDocumentMetadata(raw),
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
};

module.exports = {
  serializeDocument,
};
