'use strict';

/**
 * data.gov.il — Insurance Service Index (מדד השירות) integration config.
 */
module.exports = {
  enabled: process.env.INSURANCE_GOV_ENABLED !== 'false',
  cacheTtlMs: Number(process.env.INSURANCE_GOV_CACHE_TTL_MS) || 24 * 60 * 60 * 1000,
  fetchTimeoutMs: Number(process.env.INSURANCE_GOV_FETCH_TIMEOUT_MS) || 15000,
  ckanBaseUrl: process.env.INSURANCE_GOV_CKAN_URL || 'https://data.gov.il/api/3/action',
  csvUrlOverride: process.env.INSURANCE_GOV_CSV_URL || null,
  packageSearchQuery: process.env.INSURANCE_GOV_PACKAGE_QUERY || 'מדד שירות ביטוח',
  userAgent: process.env.INSURANCE_GOV_USER_AGENT || 'FinGuide/1.0 (insurance-advisor; +https://github.com/ofek1210/FinGuide)',
};
