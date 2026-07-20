'use strict';

const govConfig = require('../config/govDataConfig');
const cmaConfig = require('../config/cmaReportsConfig');
const pensiaConfig = require('../config/pensiaNetConfig');
const gemelConfig = require('../config/gemelNetConfig');
const { PACKAGE_IDS, resolveLatestResourceId, scoreCsvResource } = require('./govResourceDiscoveryService');
const { downloadGovCsvRecords } = require('./govCsvDownloadService');
const { downloadCmaCohortExcel } = require('./cmaReportDownloadService');
const { syncPensiaNetDataset, fetchLatestDataset } = require('./pensiaNetIngestionService');
const { syncGemelNetDataset } = require('./gemelNetIngestionService');
const { syncBituahNetDataset } = require('./bituahNetIngestionService');
const { syncPensiaNetTrackMonthly } = require('./pensiaNetTrackMonthlySyncService');
const {
  importPensiaCohortFromCkan,
  importPensiaCohortFromCmaBuffer,
  getPensiaCohortSyncMeta,
} = require('./pensiaNetCohortAnnualImportService');
const {
  importGemelCohortFromCkan,
  importGemelNetCohortAnnualExcel,
  getGemelCohortSyncMeta,
} = require('./gemelNetCohortAnnualImportService');
const PensiaNetMonthlyReturn = require('../models/PensiaNetMonthlyReturn');

/**
 * Fetch full CKAN history — CSV bulk download when enabled, else paginated API.
 */
async function fetchFullCkanRecords(net, resourceId) {
  if (govConfig.useCsvDownload && resourceId) {
    const packageId = PACKAGE_IDS[net];
    if (packageId) {
      try {
        const csv = await downloadGovCsvRecords({ packageId, resourceId });
        if (csv.records.length) return { records: csv.records, source: csv.source };
      } catch (err) {
        console.warn(`[fullSync:${net}] CSV download failed, falling back to API:`, err.message);
      }
    }
  }

  if (net === 'pensia') {
    const records = await fetchLatestDataset({ resourceId });
    return { records, source: 'data.gov.il_api' };
  }

  const { fetchCkanResource } = require('./govCkanIngestionService');
  const cfg = net === 'gemel' ? gemelConfig : require('../config/bituahNetConfig');
  const records = await fetchCkanResource({ ...cfg, resourceId });
  return { records, source: 'data.gov.il_api' };
}

async function syncPensiaCohortAnnual(opts = {}) {
  if (!cmaConfig.enabled && !cmaConfig.computeCohortFromCkan) {
    return { skipped: true, reason: 'cohort_sync_disabled' };
  }

  let ckanRecords = opts.pensiaRecords || null;

  if (!cmaConfig.computeCohortFromCkan && !opts.forceCompute) {
    return { skipped: true, reason: 'compute_disabled' };
  }

  if (!ckanRecords?.length) {
    const resolved = await resolveLatestResourceId('pensia', pensiaConfig.resourceId);
    const resourceId = resolved.resourceId;
    if (!resourceId) return { skipped: true, reason: 'no_resource_id' };
    const fetched = await fetchFullCkanRecords('pensia', resourceId);
    ckanRecords = fetched.records;
  }

  if (!ckanRecords.length) {
    return { skipped: true, reason: 'no_ckan_records' };
  }

  // Prefer official CMA Excel when reachable
  const cma = await downloadCmaCohortExcel('pensia');
  if (cma?.buffer) {
    const imported = await importPensiaCohortFromCmaBuffer(cma.buffer, {
      sourceFile: 'tsuotHodPtihaRDL.xls',
    });
    return {
      skipped: false,
      method: 'cma_excel',
      sourceUrl: cma.sourceUrl,
      ...imported,
    };
  }

  const imported = await importPensiaCohortFromCkan(ckanRecords);
  return {
    skipped: false,
    method: 'data_gov_computed',
    cmaExcelUnavailable: true,
    ...imported,
  };
}

async function syncGemelCohortAnnual(opts = {}) {
  if (!cmaConfig.enabled && !cmaConfig.computeCohortFromCkan) {
    return { skipped: true, reason: 'cohort_sync_disabled' };
  }

  let ckanRecords = opts.gemelRecords || null;

  const cma = await downloadCmaCohortExcel('gemel');
  if (cma?.buffer) {
    const imported = await importGemelNetCohortAnnualExcel(cma.buffer, {
      sourceFile: 'tsuotHodPtihaRDL.xls',
      source: 'cma_download',
    });
    return {
      skipped: false,
      method: 'cma_excel',
      sourceUrl: cma.sourceUrl,
      ...imported,
    };
  }

  if (!cmaConfig.computeCohortFromCkan) {
    return { skipped: true, reason: 'compute_disabled', cmaExcelUnavailable: true };
  }

  if (!ckanRecords?.length) {
    const resolved = await resolveLatestResourceId('gemel', gemelConfig.resourceId);
    const resourceId = resolved.resourceId;
    if (!resourceId) return { skipped: true, reason: 'no_resource_id', cmaExcelUnavailable: true };
    const fetched = await fetchFullCkanRecords('gemel', resourceId);
    ckanRecords = fetched.records;
  }

  if (!ckanRecords.length) {
    return { skipped: true, reason: 'no_ckan_records', cmaExcelUnavailable: true };
  }

  const imported = await importGemelCohortFromCkan(ckanRecords);
  return {
    skipped: false,
    method: 'data_gov_computed',
    cmaExcelUnavailable: true,
    ...imported,
  };
}

async function getTrackMonthlySyncMeta() {
  const doc = await PensiaNetMonthlyReturn.findOne({})
    .sort({ syncedAt: -1 })
    .select('syncedAt reportPeriod trackId')
    .lean();
  const count = await PensiaNetMonthlyReturn.countDocuments();
  return {
    rowCount: count,
    lastSyncedAt: doc?.syncedAt ?? null,
    latestReportPeriod: doc?.reportPeriod ?? null,
  };
}

/**
 * Full market-data sync — latest CKAN CSV + track history + cohort macro.
 * User analysis endpoints read DB snapshots only; call this via cron or POST /api/gov/sync.
 *
 * @param {{ includeCohort?: boolean, includeTrackMonthly?: boolean }} [opts]
 */
async function runFullMarketDataSync(opts = {}) {
  const includeCohort = opts.includeCohort !== false;
  const includeTrackMonthly = opts.includeTrackMonthly !== false;
  const started = Date.now();

  const [pensiaResolved, gemelResolved] = await Promise.all([
    resolveLatestResourceId('pensia', pensiaConfig.resourceId),
    resolveLatestResourceId('gemel', gemelConfig.resourceId),
  ]);

  const pensiaResourceId = pensiaResolved.resourceId || pensiaConfig.resourceId;
  const gemelResourceId = gemelResolved.resourceId || gemelConfig.resourceId;

  let pensiaRecords = null;
  let gemelRecords = null;

  if (includeCohort && govConfig.useCsvDownload) {
    try {
      if (pensiaResourceId) {
        const p = await fetchFullCkanRecords('pensia', pensiaResourceId);
        pensiaRecords = p.records;
      }
      if (gemelResourceId) {
        const g = await fetchFullCkanRecords('gemel', gemelResourceId);
        gemelRecords = g.records;
      }
    } catch (err) {
      console.warn('[fullSync] prefetch CSV for cohort failed:', err.message);
    }
  }

  const [pensia, gemel, bituah, trackMonthly, pensiaCohort, gemelCohort] = await Promise.allSettled([
    syncPensiaNetDataset({
      resourceId: pensiaResourceId,
      updateMonthly: !includeTrackMonthly,
    }),
    syncGemelNetDataset({ resourceId: gemelResourceId }),
    syncBituahNetDataset(),
    includeTrackMonthly
      ? syncPensiaNetTrackMonthly({ resourceId: pensiaResourceId })
      : Promise.resolve({ skipped: true, reason: 'disabled' }),
    includeCohort
      ? syncPensiaCohortAnnual({ pensiaRecords })
      : Promise.resolve({ skipped: true, reason: 'disabled' }),
    includeCohort
      ? syncGemelCohortAnnual({ gemelRecords })
      : Promise.resolve({ skipped: true, reason: 'disabled' }),
  ]);

  const unwrap = r => (r.status === 'fulfilled' ? r.value : { error: r.reason?.message });

  return {
    durationMs: Date.now() - started,
    resources: {
      pensia: pensiaResolved,
      gemel: gemelResolved,
    },
    pensia: unwrap(pensia),
    gemel: unwrap(gemel),
    bituah: unwrap(bituah),
    pensiaTrackMonthly: unwrap(trackMonthly),
    pensiaCohortAnnual: unwrap(pensiaCohort),
    gemelCohortAnnual: unwrap(gemelCohort),
    syncedAt: new Date().toISOString(),
  };
}

async function getFullMarketDataStatus() {
  const [
    pensiaCohort,
    gemelCohort,
    trackMonthly,
    pensiaResource,
    gemelResource,
  ] = await Promise.all([
    getPensiaCohortSyncMeta(),
    getGemelCohortSyncMeta(),
    getTrackMonthlySyncMeta(),
    resolveLatestResourceId('pensia', pensiaConfig.resourceId).catch(() => ({ resourceId: pensiaConfig.resourceId })),
    resolveLatestResourceId('gemel', gemelConfig.resourceId).catch(() => ({ resourceId: gemelConfig.resourceId })),
  ]);

  return {
    autoDiscoverResources: govConfig.autoDiscoverResources,
    useCsvDownload: govConfig.useCsvDownload,
    latestResources: {
      pensia: pensiaResource,
      gemel: gemelResource,
    },
    pensiaCohortAnnual: pensiaCohort,
    gemelCohortAnnual: gemelCohort,
    pensiaTrackMonthly: trackMonthly,
  };
}

module.exports = {
  runFullMarketDataSync,
  getFullMarketDataStatus,
  syncPensiaCohortAnnual,
  syncGemelCohortAnnual,
  fetchFullCkanRecords,
};
