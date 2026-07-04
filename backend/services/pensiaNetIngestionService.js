'use strict';

const config = require('../config/pensiaNetConfig');
const PensiaNetFund = require('../models/PensiaNetFund');
const { mapApiRecordToPensiaNet } = require('../utils/pensiaNetFieldMapper');

const CKAN_SEARCH = `${config.ckanBaseUrl}/datastore_search`;

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.fetchTimeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': config.userAgent,
        ...(options.headers || {}),
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Paginate through the full Pensia-Net CKAN resource.
 * @param {{ resourceId?: string, limit?: number }} [opts]
 * @returns {Promise<object[]>}
 */
async function fetchLatestDataset({ resourceId = config.resourceId, limit = config.pageSize } = {}) {
  const allRecords = [];
  let offset = 0;
  let total = Infinity;

  while (offset < total) {
    const url = `${CKAN_SEARCH}?resource_id=${encodeURIComponent(resourceId)}&limit=${limit}&offset=${offset}`;
    const res = await fetchWithTimeout(url);
    if (!res.ok) {
      throw new Error(`datastore_search failed (${res.status}) for offset ${offset}`);
    }

    const json = await res.json();
    if (!json.success) {
      throw new Error(json.error?.message || 'datastore_search returned success=false');
    }

    const batch = json.result?.records || [];
    total = json.result?.total ?? batch.length;
    allRecords.push(...batch);
    offset += batch.length;

    if (!batch.length) break;
  }

  return allRecords;
}

/**
 * Collapse monthly rows to the latest report period per fund ID.
 * @param {object[]} apiRecords
 * @returns {object[]}
 */
function pickLatestPerFund(apiRecords) {
  const byId = new Map();

  for (const row of apiRecords) {
    const mapped = mapApiRecordToPensiaNet(row);
    if (!mapped?.ID) continue;

    const existing = byId.get(mapped.ID);
    if (!existing || (mapped.TKUFAT_DUACH ?? 0) >= (existing.TKUFAT_DUACH ?? 0)) {
      byId.set(mapped.ID, mapped);
    }
  }

  return [...byId.values()];
}

/**
 * Upsert Pensia-Net fund snapshots into MongoDB.
 * Keeps the row with the highest TKUFAT_DUACH per ID.
 * @param {object[]} funds — mapped PensiaNet documents
 * @returns {Promise<{ upserted: number, modified: number, total: number }>}
 */
async function updateDatabase(funds) {
  if (!Array.isArray(funds) || !funds.length) {
    return { upserted: 0, modified: 0, total: 0 };
  }

  const now = new Date();
  let upserted = 0;
  let modified = 0;

  const ops = funds.map(fund => ({
    updateOne: {
      filter: { ID: fund.ID },
      update: { $set: { ...fund, syncedAt: now } },
      upsert: true,
    },
  }));

  const result = await PensiaNetFund.bulkWrite(ops, { ordered: false });
  upserted += result.upsertedCount || 0;
  modified += result.modifiedCount || 0;

  return { upserted, modified, total: funds.length };
}

/**
 * Full sync pipeline: fetch → dedupe → upsert.
 * @param {{ resourceId?: string, forceRefresh?: boolean }} [opts]
 */
async function syncPensiaNetDataset(opts = {}) {
  if (!config.enabled) {
    return { skipped: true, reason: 'PENSIANET_ENABLED=false', upserted: 0, modified: 0, total: 0 };
  }

  const apiRecords = await fetchLatestDataset(opts);
  const latestFunds = pickLatestPerFund(apiRecords);
  const stats = await updateDatabase(latestFunds);

  return {
    skipped: false,
    fetchedRows: apiRecords.length,
    uniqueFunds: latestFunds.length,
    ...stats,
    syncedAt: new Date().toISOString(),
  };
}

module.exports = {
  fetchLatestDataset,
  pickLatestPerFund,
  updateDatabase,
  syncPensiaNetDataset,
  fetchWithTimeout,
};
