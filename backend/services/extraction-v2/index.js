const { extractPayslipFields } = require('./extraction.service');
const { validatePayslipExtraction } = require('./validation.service');
const { buildCompatibleAnalysisData } = require('./adapters/compatibility.adapter');
const { buildPayslipSummaryV2 } = require('./adapters/summary.adapter');

module.exports = {
  extractPayslipFields,
  validatePayslipExtraction,
  buildCompatibleAnalysisData,
  buildPayslipSummaryV2,
};
