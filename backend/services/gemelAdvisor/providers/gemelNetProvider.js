'use strict';

const { emptyOfficialFund } = require('../schemas');

function normalizeTrackCategory(specialization = '', sub = '', stockExposure = null) {
  const text = `${specialization} ${sub}`.toLowerCase();
  if (/מניות|equity|100%/.test(text) || (stockExposure != null && stockExposure >= 60)) return 'equity';
  if (/אג"?ח|bond|סוליד|מדד/.test(text)) return 'bonds';
  if (/כללי|general/.test(text)) return 'general';
  if (/הלכ|halacha/.test(text)) return 'halacha';
  if (/גיל|age/.test(text)) return 'age_based';
  if (/מדד|index/.test(text)) return 'index';
  return 'other';
}

function inferRiskLevel(trackCategory, stockExposure) {
  if (trackCategory === 'bonds') return 'low';
  if (trackCategory === 'equity') return 'high';
  if (stockExposure != null) {
    if (stockExposure >= 55) return 'high';
    if (stockExposure < 30) return 'low';
    return 'medium';
  }
  if (trackCategory === 'general') return 'medium';
  return 'unknown';
}

function mapProductType(classification = '') {
  const t = String(classification);
  if (/השתלמות/.test(t)) return 'study_fund';
  if (/גמל/.test(t) && /השקעה/.test(t)) return 'investment_gemel';
  if (/גמל|תגמול/.test(t)) return 'gemel';
  return 'other';
}

function normalizeGemelNetRow(row) {
  if (!row) return null;
  const trackCategory = normalizeTrackCategory(row.SPECIALIZATION, row.SUB_SPECIALIZATION, row.CHSHIF_MNUIOT);
  const reportPeriod = row.TKUFAT_DUACH != null ? String(row.TKUFAT_DUACH) : null;
  return emptyOfficialFund({
    fundCode: String(row.ID || ''),
    fundName: row.SHM_KRN || '',
    companyName: row.SHM_TAAGID_MENAEL || row.SHM_TAAGID_SHOLET || '',
    productType: mapProductType(row.SUG_KRN),
    trackName: row.SPECIALIZATION || row.SUB_SPECIALIZATION || null,
    trackCategory,
    riskLevel: inferRiskLevel(trackCategory, row.CHSHIF_MNUIOT),
    reportDate: reportPeriod,
    assetsUnderManagement: row.YITRAT_NECHASIM ?? null,
    managementFeeDepositAvgPct: row.SHIUR_D_NIHUL_AHARON_HAFKADOT ?? row.SHIUR_D_NIHUL_MEANUAL ?? null,
    managementFeeBalanceAvgPct: row.SHIUR_D_NIHUL_AHARON_TTVURAH ?? row.SHIUR_D_NIHUL_MEANUAL ?? null,
    return12MonthsPct: row.TSUA_12_HODASHIM ?? null,
    return5YearsAnnualizedPct: row.TSUA_SHNATIT_MEMUZAAT_5_SHANIM ?? null,
    volatility: row.STIAT_TEKEN_36_HODASHIM ?? null,
    sharpeRatio: row.SHARPE_RATIO ?? null,
    source: 'gemelnet',
    rawData: { reportPeriod, netDomain: row.NET_DOMAIN },
  });
}

module.exports = {
  normalizeGemelNetRow,
  normalizeTrackCategory,
  inferRiskLevel,
  mapProductType,
};
