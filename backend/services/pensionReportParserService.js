'use strict';

/**
 * Thin wrapper over existing pension Excel parsers — normalizes parse entry points.
 */
const { parseClearinghouseExcel } = require('./pensionClearinghouseParser');
const { parsePensionFreeReport } = require('./pensionFreeReportParser');
const { parseHarHaKesefExcel, parseHarHaKesefText } = require('./harHaKesefService');

/**
 * @param {Buffer} buffer
 * @param {object} options — { source, filename, mimetype }
 * @returns {Promise<object>}
 */
async function parsePensionReportFile(buffer, options = {}) {
  const source = options.source || 'clearinghouse';
  let result;
  if (source === 'clearinghouse') {
    result = parseClearinghouseExcel(buffer);
  } else if (source === 'free_report') {
    result = parsePensionFreeReport(buffer, options);
  } else if (source === 'har_hakesef') {
    result = parseHarHaKesefExcel(buffer);
  } else {
    throw new Error(`Unsupported pension report source: ${source}`);
  }
  return {
    source,
    funds: result.funds || [],
    deposits: result.deposits || [],
    coverages: result.coverages || [],
    warnings: result.warnings || [],
    meta: result.meta || {},
  };
}

module.exports = {
  parsePensionReportFile,
  parseClearinghouseExcel,
  parsePensionFreeReport,
  parseHarHaKesefExcel,
  parseHarHaKesefText,
};
