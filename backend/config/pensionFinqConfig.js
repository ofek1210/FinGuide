

/** Finq market-data API — leading pension funds by risk cohort. */
const FINQ_BASE_URL = (process.env.FINQ_API_BASE_URL || 'https://api.finqai.co.il/v1').replace(/\/$/, '');

module.exports = {
  FINQ_BASE_URL,
  FINQ_AUTH_TOKEN: process.env.FINQ_AUTH_TOKEN || '',
  FINQ_ENABLED: process.env.FINQ_ENABLED !== 'false',
  FINQ_FETCH_TIMEOUT_MS: Number(process.env.FINQ_FETCH_TIMEOUT_MS) || 15000,
  /** Cache TTL per risk bucket (ms). */
  FINQ_CACHE_TTL_MS: Number(process.env.FINQ_CACHE_TTL_MS) || 6 * 60 * 60 * 1000,
  FINQ_LEADING_FUNDS_PATH: process.env.FINQ_LEADING_FUNDS_PATH || '/pensions/leadingfunds',
  FINQ_FUND_DETAIL_PATH: process.env.FINQ_FUND_DETAIL_PATH || '/pensions/funds',
  DEFAULT_CATEGORY: process.env.FINQ_PENSION_CATEGORY || 'COMPERHENSIVE',
  /** Finq enum — e.g. finqRank, yield36Months, yield12Months, avgAnnualManagementFee */
  DEFAULT_SORT: process.env.FINQ_PENSION_SORT || 'yield36Months',
  RISK_LEVELS: ['LOW', 'MEDIUM', 'HIGH', 'INCREASED'],
  DEFAULT_RISK: 'MEDIUM',
  /** UI risk cohort → Finq `riskLevel` query (smallint 1–4). */
  RISK_TO_FINQ_LEVEL: {
    LOW: 1,
    MEDIUM: 2,
    HIGH: 3,
    INCREASED: 4,
  },
};
