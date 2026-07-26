'use strict';

const path = require('path');

/** Shared data.gov.il CKAN settings for Pensia / Gemel / Bituah nets */
module.exports = {
  ckanBaseUrl: process.env.GOV_CKAN_URL || 'https://data.gov.il/api/3/action',
  pageSize: Number(process.env.GOV_CKAN_PAGE_SIZE) || 1000,
  fetchTimeoutMs: Number(process.env.GOV_CKAN_FETCH_TIMEOUT_MS) || 45000,
  userAgent: process.env.GOV_CKAN_USER_AGENT
    || 'FinGuide/1.0 (gov-market-sync; +https://github.com/ofek1210/FinGuide)',

  localDataDir: path.join(__dirname, '../data/gov'),

  cronEnabled: process.env.GOV_MARKET_CRON_ENABLED !== 'false',
  cronSchedule: process.env.GOV_MARKET_CRON_SCHEDULE || '0 2 18 * *',
  cronTimezone: process.env.GOV_MARKET_CRON_TZ || 'Asia/Jerusalem',

  /** Auto-pick newest CSV resource from data.gov.il when env ID is set but stale */
  autoDiscoverResources: process.env.GOV_AUTO_DISCOVER_RESOURCES !== 'false',

  /** Bulk CSV download from e.data.gov.il (faster than paginated API) */
  useCsvDownload: process.env.GOV_USE_CSV_DOWNLOAD !== 'false',
};
