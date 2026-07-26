'use strict';

const config = require('../config/pensiaNetConfig');
const PensiaNetFund = require('../models/PensiaNetFund');
const PensiaNetMonthlyReturn = require('../models/PensiaNetMonthlyReturn');
const { mapApiRecordToPensiaNet, mapApiRecordToMonthlyReturn } = require('../utils/pensiaNetFieldMapper');
const {
  syncGovNetDataset,
  fetchCkanResource,
  loadLocalCsv,
  getLatestSyncMeta,
} = require('./govCkanIngestionService');

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

async function updateDatabase(funds) {
  if (!Array.isArray(funds) || !funds.length) {
    return { upserted: 0, modified: 0, total: 0 };
  }

  const now = new Date();
  const ops = funds.map((fund) => ({
    updateOne: {
      filter: { ID: fund.ID },
      update: { $set: { ...fund, syncedAt: now } },
      upsert: true,
    },
  }));

  const result = await PensiaNetFund.bulkWrite(ops, { ordered: false });
  return {
    upserted: result.upsertedCount || 0,
    modified: result.modifiedCount || 0,
    total: funds.length,
  };
}

async function upsertMonthlyReturns(apiRecords) {
  const now = new Date();
  const ops = [];

  for (const row of apiRecords) {
    const mapped = mapApiRecordToMonthlyReturn(row);
    if (!mapped?.fundId || mapped.reportPeriod == null) continue;
    ops.push({
      updateOne: {
        filter: { fundId: mapped.fundId, reportPeriod: mapped.reportPeriod },
        update: { $set: { ...mapped, syncedAt: now } },
        upsert: true,
      },
    });
  }

  if (!ops.length) {
    return { upserted: 0, modified: 0, total: 0 };
  }

  const CHUNK = 500;
  let upserted = 0;
  let modified = 0;
  for (let i = 0; i < ops.length; i += CHUNK) {
    const result = await PensiaNetMonthlyReturn.bulkWrite(ops.slice(i, i + CHUNK), { ordered: false });
    upserted += result.upsertedCount || 0;
    modified += result.modifiedCount || 0;
  }

  return { upserted, modified, total: ops.length };
}

async function loadSyncSourceRecords(opts = {}) {
  const fullConfig = {
    ...config,
    resourceId: opts.resourceId || config.resourceId,
    pageSize: config.pageSizeGov || config.pageSize,
  };

  if (fullConfig.resourceId) {
    try {
      const apiRecords = await fetchCkanResource(fullConfig);
      if (apiRecords.length) {
        return { records: apiRecords, source: 'data.gov.il' };
      }
    } catch (err) {
      console.warn('[pensiaNetSync] remote fetch failed:', err.message);
    }
  }

  const local = loadLocalCsv(fullConfig);
  if (local?.length) {
    return { records: local, source: 'local_csv' };
  }

  return { records: [], source: 'none' };
}

/**
 * Full sync pipeline: local CSV / CKAN → dedupe → upsert snapshot + monthly history.
 */
async function syncPensiaNetDataset(opts = {}) {
  if (!config.enabled) {
    return { skipped: true, reason: 'PENSIANET_ENABLED=false', upserted: 0, modified: 0, total: 0 };
  }

  const updateSnapshot = opts.updateSnapshot !== false;
  const updateMonthly = opts.updateMonthly !== false;

  const snapshotResult = await syncGovNetDataset({
    config: {
      ...config,
      resourceId: opts.resourceId || config.resourceId,
      pageSize: config.pageSizeGov || config.pageSize,
    },
    Model: PensiaNetFund,
    mapper: mapApiRecordToPensiaNet,
    netKey: 'pensia',
  });

  const sourceRecords = await loadSyncSourceRecords(opts);
  let monthlyStats = { upserted: 0, modified: 0, total: 0 };
  if (updateMonthly && sourceRecords.records.length) {
    monthlyStats = await upsertMonthlyReturns(sourceRecords.records);
  }

  return {
    skipped: snapshotResult.skipped,
    source: snapshotResult.source || sourceRecords.source,
    fetchedRows: snapshotResult.fetchedRows || sourceRecords.records.length,
    uniqueFunds: snapshotResult.uniqueFunds || 0,
    snapshotUpdated: updateSnapshot,
    upserted: snapshotResult.upserted || 0,
    modified: snapshotResult.modified || 0,
    removed: snapshotResult.removed || 0,
    total: snapshotResult.total || 0,
    monthlyReturns: monthlyStats,
    syncedAt: snapshotResult.syncedAt || new Date().toISOString(),
  };
}

async function getPensiaNetStatus() {
  const meta = await getLatestSyncMeta(PensiaNetFund);
  return { net: 'pensia', sourceName: config.sourceName, ...meta };
}

module.exports = {
  fetchLatestDataset,
  pickLatestPerFund,
  updateDatabase,
  upsertMonthlyReturns,
  syncPensiaNetDataset,
  getPensiaNetStatus,
  fetchWithTimeout,
};
