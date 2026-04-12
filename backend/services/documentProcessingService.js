const Document = require('../models/Document');

let extractPayslipFile;

const getPayslipExtractor = () => {
  if (!extractPayslipFile) {
    // eslint-disable-next-line global-require
    ({ extractPayslipFile } = require('./payslipOcr'));
  }

  return extractPayslipFile;
};

const processDocumentNow = async documentId => {
  const document = await Document.findById(documentId);

  if (!document || !document.filePath) {
    return null;
  }

  if (!['pending', 'uploaded', 'processing'].includes(document.status)) {
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

const processDocumentAsync = documentId => {
  setImmediate(() => {
    processDocumentNow(documentId).catch(error => {
      console.error('❌ Async document processing crashed', documentId, error);
    });
  });
};

module.exports = {
  processDocumentAsync,
  processDocumentNow,
};
