const Document = require('../models/Document');
const {
  extractPayslipFields,
  validatePayslipExtraction,
} = require('./extraction-v2');

let extractPayslipFile;

const toRawLinesFallback = rawText => String(rawText || '')
  .split(/\r?\n/)
  .map(line => line.trim())
  .filter(Boolean);

const normalizeRawLinesForV2 = (rawLines, rawText) => {
  if (Array.isArray(rawLines) && rawLines.length > 0) {
    const cleaned = rawLines
      .map(line => (line == null ? '' : String(line).trim()))
      .filter(Boolean);
    if (cleaned.length > 0) {
      return cleaned;
    }
  }
  return toRawLinesFallback(rawText);
};

const getPayslipExtractor = () => {
  if (!extractPayslipFile) {
    // eslint-disable-next-line global-require
    ({ extractPayslipFile } = require('./payslipOcr'));
  }

  return extractPayslipFile;
};

const applyExtractorV2Shadow = async analysisData => {
  if (!analysisData || typeof analysisData !== 'object') {
    return analysisData;
  }

  const data = { ...analysisData };
  const rawText = data.raw?.rawText || data.raw?.ocr_text || '';
  const rawLines = normalizeRawLinesForV2(data.raw?.rawLines, rawText);
  const extractionMethod = data.raw?.extractionMethod || null;

  if (!rawText || !String(rawText).trim()) {
    return analysisData;
  }

  data.pipeline_version = 'extractor-v2-shadow';
  data.quality = data.quality && typeof data.quality === 'object' ? data.quality : {};
  data.quality.warnings = Array.isArray(data.quality.warnings) ? data.quality.warnings : [];
  data.quality.debug = data.quality.debug && typeof data.quality.debug === 'object'
    ? data.quality.debug
    : {};

  try {
    const extractionResult = await extractPayslipFields({
      rawText,
      rawLines,
      extractionMethod,
      rawPayload: data.raw || {},
    });
    const validationResult = validatePayslipExtraction({ extractionResult });

    data.extraction_v2 = extractionResult;
    data.quality.validation = validationResult;
    data.quality.debug.extraction_v2_shadow = {
      status: 'ok',
      rawLinesCount: rawLines.length,
      extracted_field_count: Object.keys(extractionResult.fields || {}).length,
      extracted_field_keys: Object.keys(extractionResult.fields || {}),
      amount_logic: extractionResult.meta?.debug?.amountExtraction || null,
    };
  } catch (error) {
    data.quality.warnings.push('[extractor-v2-shadow] v2 extraction failed; legacy output kept.');
    data.quality.debug.extraction_v2_shadow = {
      status: 'failed',
      rawLinesCount: rawLines.length,
      error: error?.message || 'unknown extractor-v2 error',
    };
  }

  return data;
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
    const shadowData = await applyExtractorV2Shadow(data);

    document.analysisData = shadowData;
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
