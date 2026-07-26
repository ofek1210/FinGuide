'use strict';

const fs = require('fs');
const path = require('path');
const { parseGovCsv, readGovCsvFile } = require('../utils/govCsvParser');

const CKAN_SEARCH_SUFFIX = '/datastore_search';

async function fetchWithTimeout(url, options = {}, timeoutMs = 30000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(options.headers || {}),
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Paginate CKAN datastore_search for a resource.
 */
async function fetchCkanResource(config) {
  if (!config.resourceId) return [];

  const base = `${config.ckanBaseUrl}${CKAN_SEARCH_SUFFIX}`;
  const allRecords = [];
  let offset = 0;
  let total = Infinity;

  while (offset < total) {
    const url = `${base}?resource_id=${encodeURIComponent(config.resourceId)}&limit=${config.pageSize}&offset=${offset}`;
    const res = await fetchWithTimeout(url, {
      headers: { 'User-Agent': config.userAgent },
    }, config.fetchTimeoutMs);

    if (!res.ok) throw new Error(`datastore_search failed (${res.status}) offset=${offset}`);

    const json = await res.json();
    if (!json.success) {
      throw new Error(json.error?.message || 'datastore_search success=false');
    }

    const batch = json.result?.records || [];
    total = json.result?.total ?? batch.length;
    allRecords.push(...batch);
    offset += batch.length;
    if (!batch.length) break;
  }

  return allRecords;
}

function loadLocalCsv(config) {
  const csvPath = path.join(config.localDataDir, config.localCsvFile);
  if (!fs.existsSync(csvPath)) return null;
  return parseGovCsv(readGovCsvFile(csvPath));
}

function pickLatestPerFund(apiRecords, mapper) {
  const byId = new Map();
  for (const row of apiRecords) {
    const mapped = mapper(row);
    if (!mapped?.ID) continue;
    const existing = byId.get(mapped.ID);
    if (!existing || (mapped.TKUFAT_DUACH ?? 0) >= (existing.TKUFAT_DUACH ?? 0)) {
      byId.set(mapped.ID, mapped);
    }
  }
  return [...byId.values()];
}

async function upsertFunds(Model, funds) {
  if (!funds.length) return { upserted: 0, modified: 0, total: 0 };

  const now = new Date();
  const ops = funds.map(fund => ({
    updateOne: {
      filter: { ID: fund.ID },
      update: { $set: { ...fund, syncedAt: now } },
      upsert: true,
    },
  }));

  const result = await Model.bulkWrite(ops, { ordered: false });
  return {
    upserted: result.upsertedCount || 0,
    modified: result.modifiedCount || 0,
    total: funds.length,
  };
}

async function removeStaleFunds(Model, latestFunds) {
  if (!latestFunds.length) return 0;
  const activeIds = latestFunds.map((fund) => fund.ID);
  const result = await Model.deleteMany({ ID: { $nin: activeIds } });
  return result.deletedCount || 0;
}

/**
 * Generic sync: CKAN API → fallback local CSV → MongoDB.
 */
async function syncGovNetDataset({ config, Model, mapper, netKey }) {
  if (!config.enabled) {
    return { skipped: true, net: netKey, reason: 'disabled', upserted: 0, modified: 0, total: 0 };
  }

  let apiRecords = [];
  let source = 'data.gov.il';

  if (config.resourceId) {
    try {
      apiRecords = await fetchCkanResource(config);
    } catch (err) {
      console.warn(`[govSync:${netKey}] remote fetch failed:`, err.message);
    }
  }

  if (!apiRecords.length) {
    const local = loadLocalCsv(config);
    if (local?.length) {
      apiRecords = local;
      source = 'local_csv';
    }
  }

  if (!apiRecords.length) {
    return {
      skipped: true,
      net: netKey,
      reason: 'no_data',
      upserted: 0,
      modified: 0,
      total: 0,
    };
  }

  const latestFunds = pickLatestPerFund(apiRecords, mapper);
  const stats = await upsertFunds(Model, latestFunds);
  const removed = await removeStaleFunds(Model, latestFunds);

  return {
    skipped: false,
    net: netKey,
    source,
    fetchedRows: apiRecords.length,
    uniqueFunds: latestFunds.length,
    ...stats,
    removed,
    syncedAt: new Date().toISOString(),
  };
}

async function countFunds(Model) {
  return Model.countDocuments();
}

async function getLatestSyncMeta(Model) {
  const doc = await Model.findOne({}).sort({ syncedAt: -1 }).select('syncedAt TKUFAT_DUACH').lean();
  return {
    fundCount: await countFunds(Model),
    lastSyncedAt: doc?.syncedAt ?? null,
    latestReportPeriod: doc?.TKUFAT_DUACH ?? null,
  };
}

module.exports = {
  fetchCkanResource,
  loadLocalCsv,
  pickLatestPerFund,
  syncGovNetDataset,
  getLatestSyncMeta,
  parseGovCsv,
};
