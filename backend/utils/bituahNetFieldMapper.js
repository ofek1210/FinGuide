'use strict';

const { toNumber } = require('./pensiaNetFieldMapper');

function mapApiRecordToBituahNet(record) {
  if (!record || record.FUND_ID == null) return null;

  const foreignRaw = toNumber(record.FOREIGN_EXPOSURE);
  const foreignPct = foreignRaw == null
    ? null
    : (Math.abs(foreignRaw) <= 1 ? foreignRaw * 100 : foreignRaw);

  return {
    ID: String(record.FUND_ID),
    SHM_KRN: String(record.FUND_NAME || '').trim(),
    SHM_TAAGID_MENAEL: String(record.PARENT_COMPANY_NAME || '').trim(),
    SHM_TAAGID_SHOLET: String(record.PARENT_COMPANY_NAME || '').trim(),
    SUG_KRN: String(record.FUND_CLASSIFICATION || '').trim(),
    POLICY_GENERATION: String(record.FUND_CLASSIFICATION || '').trim(),
    TKUFAT_DUACH: toNumber(record.REPORT_PERIOD),
    SHIUR_D_NIHUL_AHARON_HAFKADOT: toNumber(record.AVG_DEPOSIT_FEE),
    SHIUR_D_NIHUL_MEANUAL: toNumber(record.AVG_ANNUAL_MANAGEMENT_FEE),
    SHIUR_D_NIHUL_AHARON_TTVURAH: toNumber(record.AVG_ANNUAL_MANAGEMENT_FEE),
    TSUA_SHNATIT_MEMUZAAT_5_SHANIM: toNumber(record.AVG_ANNUAL_YIELD_TRAILING_5YRS),
    STIAT_TEKEN_36_HODASHIM: toNumber(record.STANDARD_DEVIATION),
    SHARPE_RATIO: toNumber(record.SHARPE_RATIO),
    BETA_HUTZ_LAARETZ: foreignPct,
    CHSHIF_MNUIOT: toNumber(record.STOCK_MARKET_EXPOSURE),
    YITRAT_NECHASIM: toNumber(record.TOTAL_ASSETS),
    NET_DOMAIN: 'bituah',
    raw: record,
  };
}

module.exports = { mapApiRecordToBituahNet };
