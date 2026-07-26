'use strict';

const govConfig = require('../config/govDataConfig');
const { parseGovCsv } = require('../utils/govCsvParser');
const { discoverLatestCsvResource } = require('./govResourceDiscoveryService');

async function fetchWithTimeout(url, timeoutMs = govConfig.fetchTimeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'text/csv,*/*',
        'User-Agent': govConfig.userAgent,
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Download full CKAN CSV export (faster than paginated datastore_search for large datasets).
 * @param {{ packageId: string, resourceId?: string, downloadUrl?: string }} opts
 * @returns {Promise<{ records: object[], source: string, downloadUrl: string, resourceId: string|null }>}
 */
async function downloadGovCsvRecords(opts) {
  let downloadUrl = opts.downloadUrl;
  let resourceId = opts.resourceId || null;

  if (!downloadUrl) {
    const discovered = await discoverLatestCsvResource(opts.packageId);
    if (!discovered) {
      return { records: [], source: 'none', downloadUrl: '', resourceId: null };
    }
    downloadUrl = discovered.downloadUrl;
    resourceId = discovered.resourceId;
  }

  const res = await fetchWithTimeout(downloadUrl);
  if (!res.ok) {
    throw new Error(`CSV download failed (${res.status}) ${downloadUrl}`);
  }

  const text = await res.text();
  const records = parseGovCsv(text);

  return {
    records,
    source: 'data.gov.il_csv',
    downloadUrl,
    resourceId,
    rowCount: records.length,
  };
}

module.exports = { downloadGovCsvRecords };
