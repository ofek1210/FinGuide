const Document = require('../models/Document');
const { normalizePayslipAnalysis } = require('./payslipAnalysisService');
const {
  persistOcrDebugArtifact,
  removeOcrDebugArtifact,
} = require('./ocrDebugArtifactService');

let extractPayslipFile;

const PROCESSING_LEASE_MS =
  Number(process.env.OCR_PROCESSING_LEASE_MS) > 0
    ? Number(process.env.OCR_PROCESSING_LEASE_MS)
    : 60 * 1000;
const PROCESSING_HEARTBEAT_MS = Math.max(10 * 1000, Math.floor(PROCESSING_LEASE_MS / 3));
const WORKER_POLL_INTERVAL_MS =
  Number(process.env.OCR_WORKER_POLL_INTERVAL_MS) > 0
    ? Number(process.env.OCR_WORKER_POLL_INTERVAL_MS)
    : 2000;

const getPayslipExtractor = () => {
  if (!extractPayslipFile) {
    // eslint-disable-next-line global-require
    ({ extractPayslipFile } = require('./payslipOcr'));
  }

  return extractPayslipFile;
};

const leaseExpiryFromNow = () => new Date(Date.now() + PROCESSING_LEASE_MS);

const logProcessingEvent = (level, message, meta = {}) => {
  const logger = level === 'error' ? console.error : console.log;
  logger('[documentProcessing]', {
    level,
    message,
    ...meta,
  });
};

const queueUpdate = {
  status: 'pending',
  processingStage: 'queued',
  processingLeaseExpiresAt: null,
  processingError: null,
  processingStartedAt: null,
  processingFinishedAt: null,
  processedAt: null,
  ocrDebugArtifactPath: null,
};

const requestDocumentProcessing = async (documentId, { force = false } = {}) => {
  if (!documentId) {
    return null;
  }

  const query = {
    _id: documentId,
    ...(force ? { status: { $ne: 'processing' } } : { status: { $in: ['uploaded', 'pending', 'failed'] } }),
  };

  const updated = await Document.findOneAndUpdate(
    query,
    {
      $set: queueUpdate,
      ...(force ? { $unset: { analysisData: 1 } } : {}),
    },
    { new: true }
  );

  return updated;
};

const recoverExpiredProcessingLeases = async () => {
  const now = new Date();

  const result = await Document.updateMany(
    {
      status: 'processing',
      $or: [
        { processingLeaseExpiresAt: null },
        { processingLeaseExpiresAt: { $lte: now } },
      ],
    },
    {
      $set: {
        status: 'pending',
        processingStage: 'queued',
        processingLeaseExpiresAt: null,
      },
    }
  );

  return result.modifiedCount || 0;
};

const resumePendingDocumentProcessing = async () => recoverExpiredProcessingLeases();

const acquireNextDocumentForProcessing = async () => {
  const now = new Date();
  const lease = leaseExpiryFromNow();

  return Document.findOneAndUpdate(
    {
      $or: [
        { status: 'pending' },
        {
          status: 'processing',
          $or: [
            { processingLeaseExpiresAt: null },
            { processingLeaseExpiresAt: { $lte: now } },
          ],
        },
      ],
    },
    {
      $set: {
        status: 'processing',
        processingStage: 'extract_text',
        processingStartedAt: now,
        processingLeaseExpiresAt: lease,
        processingError: null,
      },
      $inc: {
        processingAttempts: 1,
      },
    },
    {
      new: true,
      sort: {
        uploadedAt: 1,
        updatedAt: 1,
      },
    }
  );
};

const extendProcessingLease = async documentId => {
  if (!documentId) {
    return null;
  }

  return Document.findOneAndUpdate(
    {
      _id: documentId,
      status: 'processing',
    },
    {
      $set: {
        processingLeaseExpiresAt: leaseExpiryFromNow(),
      },
    },
    { new: true }
  );
};

const updateProcessingStage = async (documentId, stage) => {
  if (!documentId || !stage) {
    return null;
  }

  return Document.findOneAndUpdate(
    {
      _id: documentId,
    },
    {
      $set: {
        processingStage: stage,
        ...(stage === 'processing' ? { status: 'processing' } : {}),
      },
    },
    { new: true }
  );
};

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

const startLeaseHeartbeat = documentId => setInterval(() => {
  extendProcessingLease(documentId).catch(error => {
    logProcessingEvent('error', 'lease_heartbeat_failed', {
      documentId,
      errorType: error?.name || 'Error',
    });
  });
}, PROCESSING_HEARTBEAT_MS);

const finalizeSuccess = async ({
  document,
  normalizedAnalysis,
  debugArtifactPath,
  startedAt,
}) => {
  const finishedAt = new Date();

  if (!debugArtifactPath && document.ocrDebugArtifactPath) {
    await removeOcrDebugArtifact(document.ocrDebugArtifactPath);
  }

  document.analysisData = normalizedAnalysis;
  document.ocrDebugArtifactPath = debugArtifactPath;
  document.status = 'completed';
  document.processingStage = 'completed';
  document.processingError = null;
  document.processedAt = finishedAt;
  document.processingFinishedAt = finishedAt;
  document.processingLeaseExpiresAt = null;
  await document.save();

  logProcessingEvent('info', 'processing_completed', {
    documentId: document._id.toString(),
    stage: 'completed',
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    status: document.status,
  });

  return document;
};

const finalizeFailure = async ({ document, error, startedAt }) => {
  const finishedAt = new Date();
  document.status = 'failed';
  document.processingStage = 'failed';
  document.processingError = error?.message || 'Document processing failed';
  document.processedAt = finishedAt;
  document.processingFinishedAt = finishedAt;
  document.processingLeaseExpiresAt = null;
  await document.save().catch(() => {});

  logProcessingEvent('error', 'processing_failed', {
    documentId: document._id.toString(),
    stage: 'failed',
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    status: document.status,
    errorType: error?.name || 'Error',
  });

  return document;
};

const processDocumentRecord = async document => {
  if (!document || !document.filePath) {
    return null;
  }

  const startedAt = new Date();
  const heartbeat = startLeaseHeartbeat(document._id.toString());

  try {
    logProcessingEvent('info', 'processing_started', {
      documentId: document._id.toString(),
      stage: document.processingStage,
      status: document.status,
    });

    await updateProcessingStage(document._id, 'run_ocr');
    const { data } = await getPayslipExtractor()(document.filePath);

    await updateProcessingStage(document._id, 'resolve_fields');
    const normalizedAnalysis = normalizePayslipAnalysis(data);

    const debugArtifactPath = await persistOcrDebugArtifact({
      documentId: document._id.toString(),
      payload: {
        documentId: document._id.toString(),
        sourcePath: document.filePath,
        capturedAt: new Date().toISOString(),
        analysis: data,
      },
    });

    await updateProcessingStage(document._id, 'finalize');
    const freshDocument = await Document.findById(document._id);
    if (!freshDocument) {
      clearInterval(heartbeat);
      return null;
    }

    clearInterval(heartbeat);
    return finalizeSuccess({
      document: freshDocument,
      normalizedAnalysis,
      debugArtifactPath,
      startedAt,
    });
  } catch (error) {
    clearInterval(heartbeat);
    const freshDocument = await Document.findById(document._id);

    if (!freshDocument) {
      return null;
    }

    return finalizeFailure({
      document: freshDocument,
      error,
      startedAt,
    });
  }
};

const processDocumentNow = async (documentId, { force = false } = {}) => {
  const document = await Document.findById(documentId);

  if (!document || !document.filePath) {
    return null;
  }

  const allowedStatuses = force
    ? ['pending', 'uploaded', 'processing', 'failed']
    : ['pending', 'uploaded', 'processing'];

  if (!allowedStatuses.includes(document.status)) {
    return document;
  }

  document.status = 'processing';
  document.processingStage = 'extract_text';
  document.processingStartedAt = new Date();
  document.processingLeaseExpiresAt = leaseExpiryFromNow();
  document.processingError = null;
  document.processingAttempts = (document.processingAttempts || 0) + 1;
  await document.save();

  return processDocumentRecord(document);
};

const processDocumentAsync = async documentId => requestDocumentProcessing(documentId);

const startDocumentWorker = async ({ once = false } = {}) => {
  await recoverExpiredProcessingLeases();

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const nextDocument = await acquireNextDocumentForProcessing();

    if (!nextDocument) {
      if (once) {
        return false;
      }

      await delay(WORKER_POLL_INTERVAL_MS);
      continue;
    }

    await processDocumentRecord(nextDocument);

    if (once) {
      return true;
    }
  }
};

module.exports = {
  WORKER_POLL_INTERVAL_MS,
  acquireNextDocumentForProcessing,
  extendProcessingLease,
  processDocumentAsync,
  processDocumentNow,
  requestDocumentProcessing,
  resumePendingDocumentProcessing,
  recoverExpiredProcessingLeases,
  startDocumentWorker,
  updateProcessingStage,
};
