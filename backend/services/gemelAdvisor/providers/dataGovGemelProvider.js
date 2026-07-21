'use strict';

const { emptyOfficialFund } = require('../schemas');
const { normalizeTrackCategory, inferRiskLevel, mapProductType } = require('./gemelNetProvider');

/**
 * Normalize data.gov.il CSV row (English column names from gemel-net.csv).
 */
function normalizeDataGovRow(record) {
  if (!record || record.FUND_ID == null) return null;

  const stockExposure = record.STOCK_MARKET_EXPOSURE != null
    ? parseFloat(record.STOCK_MARKET_EXPOSURE)
    : null;
  const trackCategory = normalizeTrackCategory(
    record.SPECIALIZATION || '',
    record.SUB_SPECIALIZATION || '',
    stockExposure,
  );

  return emptyOfficialFund({
    fundCode: String(record.FUND_ID),
    fundName: record.FUND_NAME || '',
    companyName: record.MANAGING_CORPORATION || record.CONTROLLING_CORPORATION || '',
    productType: mapProductType(record.FUND_CLASSIFICATION || ''),
    trackName: record.SPECIALIZATION || record.SUB_SPECIALIZATION || null,
    trackCategory,
    riskLevel: inferRiskLevel(trackCategory, stockExposure),
    reportDate: record.REPORT_PERIOD ? String(record.REPORT_PERIOD) : null,
    assetsUnderManagement: record.TOTAL_ASSETS != null ? parseFloat(record.TOTAL_ASSETS) : null,
    managementFeeDepositAvgPct: record.AVG_DEPOSIT_FEE != null ? parseFloat(record.AVG_DEPOSIT_FEE) : null,
    managementFeeBalanceAvgPct: record.AVG_ANNUAL_MANAGEMENT_FEE != null ? parseFloat(record.AVG_ANNUAL_MANAGEMENT_FEE) : null,
    return1MonthPct: record.MONTHLY_YIELD != null ? parseFloat(record.MONTHLY_YIELD) : null,
    return12MonthsPct: record.YEAR_TO_DATE_YIELD != null ? parseFloat(record.YEAR_TO_DATE_YIELD) : null,
    return3YearsCumulativePct: record.YIELD_TRAILING_3_YRS != null ? parseFloat(record.YIELD_TRAILING_3_YRS) : null,
    return5YearsCumulativePct: record.YIELD_TRAILING_5_YRS != null ? parseFloat(record.YIELD_TRAILING_5_YRS) : null,
    return3YearsAnnualizedPct: record.AVG_ANNUAL_YIELD_TRAILING_3YRS != null ? parseFloat(record.AVG_ANNUAL_YIELD_TRAILING_3YRS) : null,
    return5YearsAnnualizedPct: record.AVG_ANNUAL_YIELD_TRAILING_5YRS != null ? parseFloat(record.AVG_ANNUAL_YIELD_TRAILING_5YRS) : null,
    volatility: record.STANDARD_DEVIATION != null ? parseFloat(record.STANDARD_DEVIATION) : null,
    sharpeRatio: record.SHARPE_RATIO != null ? parseFloat(record.SHARPE_RATIO) : null,
    source: 'data.gov.il',
    rawData: { currentDate: record.CURRENT_DATE, reportPeriod: record.REPORT_PERIOD },
  });
}

module.exports = { normalizeDataGovRow };
