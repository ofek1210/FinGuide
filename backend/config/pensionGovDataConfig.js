

/**
 * data.gov.il / Pensia-Net integration config.
 * Override CSV URL via PENSION_GOV_CSV_URL for direct download (bypasses CKAN lookup).
 */
module.exports = {
  enabled: process.env.PENSION_GOV_ENABLED !== 'false',
  cacheTtlMs: Number(process.env.PENSION_GOV_CACHE_TTL_MS) || 24 * 60 * 60 * 1000,
  fetchTimeoutMs: Number(process.env.PENSION_GOV_FETCH_TIMEOUT_MS) || 15000,
  ckanBaseUrl: process.env.PENSION_GOV_CKAN_URL || 'https://data.gov.il/api/3/action',
  /** Direct CSV resource URL — optional override */
  csvUrlOverride: process.env.PENSION_GOV_CSV_URL || null,
  /** CKAN package search query for Pensia-Net */
  packageSearchQuery: process.env.PENSION_GOV_PACKAGE_QUERY || 'פנסיה-נט',
  userAgent: process.env.PENSION_GOV_USER_AGENT || 'FinGuide/1.0 (pension-advisor; +https://github.com/ofek1210/FinGuide)',
};
