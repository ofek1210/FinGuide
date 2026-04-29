const { getDocumentMetadata } = require('../utils/documentMetadata');

const sanitizeAnalysisDataForApi = analysisData => {
  if (!analysisData || typeof analysisData !== 'object') {
    return {};
  }

  const safe = {
    ...analysisData,
  };

  if (safe.raw && typeof safe.raw === 'object') {
    const { rawText, ocr_text, ...restRaw } = safe.raw;
    safe.raw = restRaw;
  }

  if (safe.quality && typeof safe.quality === 'object') {
    const { debug, ...restQuality } = safe.quality;
    safe.quality = restQuality;
  }

  return safe;
};

const serializeDocument = document => {
  const raw = document && typeof document.toObject === 'function'
    ? document.toObject()
    : document;

  if (!raw) {
    return null;
  }

  return {
    id: raw._id?.toString?.() || raw._id,
    _id: raw._id?.toString?.() || raw._id,
    originalName: raw.originalName,
    fileSize: raw.fileSize,
    mimeType: raw.mimeType,
    status: raw.status,
    uploadedAt: raw.uploadedAt,
    processedAt: raw.processedAt || null,
    analysisData: sanitizeAnalysisDataForApi(raw.analysisData),
    metadata: getDocumentMetadata(raw),
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
};

module.exports = {
  sanitizeAnalysisDataForApi,
  serializeDocument,
};
