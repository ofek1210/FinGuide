const Document = require('../models/Document');

let extractPayslipFile;
const queuedDocumentIds = new Set();

const getPayslipExtractor = () => {
  if (!extractPayslipFile) {
    // eslint-disable-next-line global-require
    ({ extractPayslipFile } = require('./payslipOcr'));
  }

  return extractPayslipFile;
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
  document.processingError = null;
  await document.save();

  try {
    const { data } = await getPayslipExtractor()(document.filePath);

    document.analysisData = data;
    document.status = 'completed';
    document.processingError = null;
    document.processedAt = new Date();
    await document.save();
  } catch (error) {
    console.error('❌ Document extraction failed for document', document._id, error);
    document.status = 'failed';
    document.processingError = error?.message || 'Document processing failed';
    document.processedAt = new Date();
    await document.save().catch(() => {});
  }

  return document;
};

const requestDocumentProcessing = (documentId, { force = false } = {}) => {
  if (!documentId || queuedDocumentIds.has(documentId)) {
    return false;
  }

  queuedDocumentIds.add(documentId);

  setImmediate(() => {
    processDocumentNow(documentId, { force })
      .catch(error => {
        console.error('❌ Async document processing crashed', documentId, error);
      })
      .finally(() => {
        queuedDocumentIds.delete(documentId);
      });
  });

  return true;
};

const processDocumentAsync = documentId => requestDocumentProcessing(documentId);

const resumePendingDocumentProcessing = async () => {
  const pendingDocuments = await Document.find({
    status: { $in: ['pending', 'processing'] },
  })
    .select('_id')
    .lean();

  pendingDocuments.forEach(document => {
    requestDocumentProcessing(document._id.toString());
  });

  return pendingDocuments.length;
};

module.exports = {
  requestDocumentProcessing,
  processDocumentAsync,
  processDocumentNow,
  resumePendingDocumentProcessing,
};
