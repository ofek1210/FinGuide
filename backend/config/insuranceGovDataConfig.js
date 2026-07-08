

/**
 * data.gov.il — Insurance Service Index (מדד השירות).
 * Remote fetch disabled by default — use local CSV in backend/data/insurance/.
 * Do NOT scrape health-insurance comparison sites (CAPTCHA protection).
 */
module.exports = {
  enabled: process.env.INSURANCE_GOV_ENABLED === 'true',
  /** When false (default), never HTTP-fetch — local CSV + static tables only */
  remoteFetchEnabled: process.env.INSURANCE_GOV_REMOTE_FETCH === 'true',
  localDataDir: require('path').join(__dirname, '../data/insurance'),
  localServiceIndexFile: 'service-index.csv',
  cacheTtlMs: Number(process.env.INSURANCE_GOV_CACHE_TTL_MS) || 24 * 60 * 60 * 1000,
  fetchTimeoutMs: Number(process.env.INSURANCE_GOV_FETCH_TIMEOUT_MS) || 15000,
  ckanBaseUrl: process.env.INSURANCE_GOV_CKAN_URL || 'https://data.gov.il/api/3/action',
  csvUrlOverride: process.env.INSURANCE_GOV_CSV_URL || null,
  packageSearchQuery: process.env.INSURANCE_GOV_PACKAGE_QUERY || 'מדד שירות ביטוח',
  userAgent: process.env.INSURANCE_GOV_USER_AGENT || 'FinGuide/1.0 (insurance-advisor; +https://github.com/ofek1210/FinGuide)',
};
