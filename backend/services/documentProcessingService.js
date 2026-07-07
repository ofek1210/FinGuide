const Document = require('../models/Document');
const { validatePayslipAnalysis, buildFieldsMeta } = require('../schemas/payslipAnalysis.schema');

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
    const { data } = await getPayslipExtractor()(document.filePath, { userId: document.user });

    const fieldsMeta = buildFieldsMeta(data);
    if (fieldsMeta) data.fields_meta = fieldsMeta;

    const validation = validatePayslipAnalysis(data);
    document.analysisData = data;
    document.processedAt = new Date();
    if (validation.ok) {
      document.status = 'completed';
      document.processingError = null;
    } else {
      document.status = 'needs_review';
      document.processingError = validation.message;
    }
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
