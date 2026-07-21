'use strict';

const { parseReportPeriod } = require('./pensiaNetCompounding');

function toNumberSafe(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Map CKAN row → investment track monthly return (מסלול, not מנהל).
 * @param {object} record
 * @returns {{ ok: true, doc: object } | { ok: false, reason: string }}
 */
function mapApiRecordToTrackMonthlyReturn(record) {
  if (!record) return { ok: false, reason: 'empty_record' };
  if (record.FUND_ID == null || record.FUND_ID === '') {
    return { ok: false, reason: 'missing_track_id' };
  }
  if (record.REPORT_PERIOD == null || record.REPORT_PERIOD === '') {
    return { ok: false, reason: 'missing_report_period' };
  }

  const period = parseReportPeriod(record.REPORT_PERIOD);
  if (!period) return { ok: false, reason: 'invalid_report_period' };

  const monthlyYield = toNumberSafe(record.MONTHLY_YIELD);
  if (monthlyYield == null) {
    return { ok: false, reason: 'missing_monthly_yield' };
  }

  const trackId = String(record.FUND_ID).trim();
  const trackName = String(record.FUND_NAME || '').trim();

  return {
    ok: true,
    doc: {
      trackId,
      fundId: trackId,
      trackName,
      fundName: trackName,
      classification: String(record.FUND_CLASSIFICATION || '').trim(),
      managingCorporation: String(record.MANAGING_CORPORATION || '').trim(),
      reportPeriod: period.reportPeriod,
      reportYear: period.year,
      reportMonth: period.month,
      monthlyYield,
      ytdYield: toNumberSafe(record.YEAR_TO_DATE_YIELD),
      alpha: toNumberSafe(record.ALPHA),
      sharpeRatio: toNumberSafe(record.SHARPE_RATIO),
      standardDeviation: toNumberSafe(record.STANDARD_DEVIATION),
      stockExposure: toNumberSafe(record.STOCK_MARKET_EXPOSURE),
      source: 'data_gov_ckan',
    },
  };
}

module.exports = { mapApiRecordToTrackMonthlyReturn };
