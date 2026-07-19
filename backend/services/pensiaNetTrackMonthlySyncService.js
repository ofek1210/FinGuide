'use strict';

const PensiaNetMonthlyReturn = require('../models/PensiaNetMonthlyReturn');
const { fetchLatestDataset } = require('./pensiaNetIngestionService');
const { mapApiRecordToTrackMonthlyReturn } = require('../utils/pensiaNetTrackMonthlyMapper');
const { buildCompoundedWindows } = require('../utils/pensiaNetCompounding');
const config = require('../config/pensiaNetConfig');

const REJECTION_LABELS = {
  empty_record: 'רשומה ריקה',
  missing_track_id: 'חסר מזהה מסלול (FUND_ID)',
  missing_report_period: 'חסר תקופת דיווח',
  invalid_report_period: 'תקופת דיווח לא תקינה',
  missing_monthly_yield: 'חסרה תשואה חודשית',
};

/**
 * Validate and map CKAN rows to track monthly documents.
 * @param {object[]} apiRecords
 * @returns {{ docs: object[], report: object }}
 */
function validateAndMapTrackMonthlyRows(apiRecords) {
  const report = {
    rowsRead: apiRecords.length,
    tracksIdentified: 0,
    rejected: 0,
    rejectionReasons: {},
    rejectedSamples: [],
  };

  const docs = [];
  const trackIds = new Set();

  for (const row of apiRecords) {
    const mapped = mapApiRecordToTrackMonthlyReturn(row);
    if (!mapped.ok) {
      report.rejected += 1;
      report.rejectionReasons[mapped.reason] = (report.rejectionReasons[mapped.reason] || 0) + 1;
      if (report.rejectedSamples.length < 10) {
        report.rejectedSamples.push({
          reason: mapped.reason,
          reasonLabel: REJECTION_LABELS[mapped.reason] || mapped.reason,
          fundId: row?.FUND_ID ?? null,
          reportPeriod: row?.REPORT_PERIOD ?? null,
        });
      }
      continue;
    }
    trackIds.add(mapped.doc.trackId);
    docs.push(mapped.doc);
  }

  report.tracksIdentified = trackIds.size;
  return { docs, report };
}

/**
 * Upsert track monthly returns — idempotent on trackId + reportPeriod.
 * @param {object[]} docs
 * @param {{ dryRun?: boolean }} [opts]
 */
async function upsertTrackMonthlyReturns(docs, opts = {}) {
  if (opts.dryRun) {
    return { upserted: 0, modified: 0, matched: 0, total: docs.length, dryRun: true };
  }

  const now = new Date();
  const ops = docs.map(doc => ({
    updateOne: {
      filter: { trackId: doc.trackId, reportPeriod: doc.reportPeriod },
      update: { $set: { ...doc, syncedAt: now } },
      upsert: true,
    },
  }));

  if (!ops.length) {
    return { upserted: 0, modified: 0, matched: 0, total: 0 };
  }

  const CHUNK = 500;
  let upserted = 0;
  let modified = 0;
  let matched = 0;

  for (let i = 0; i < ops.length; i += CHUNK) {
    const result = await PensiaNetMonthlyReturn.bulkWrite(ops.slice(i, i + CHUNK), { ordered: false });
    upserted += result.upsertedCount || 0;
    modified += result.modifiedCount || 0;
    matched += result.matchedCount || 0;
  }

  return {
    upserted,
    modified,
    matched,
    total: ops.length,
    unchanged: Math.max(0, matched - modified),
  };
}

/**
 * Load monthly history for sample tracks and compute compounded windows.
 * @param {string[]} trackIds
 */
async function sampleTrackCompoundedReturns(trackIds) {
  const samples = [];

  for (const trackId of trackIds) {
    const rows = await PensiaNetMonthlyReturn.find({ trackId: String(trackId), monthlyYield: { $ne: null } })
      .sort({ reportPeriod: -1 })
      .select('trackId trackName reportPeriod reportYear reportMonth monthlyYield')
      .lean();

    if (!rows.length) {
      samples.push({ trackId, error: 'no_rows_after_sync' });
      continue;
    }

    const compounded = buildCompoundedWindows(rows);
    samples.push({
      trackId,
      trackName: rows[0].trackName || rows[0].fundName,
      lastReportDate: compounded.lastReportDate,
      lastReportPeriod: compounded.lastReportPeriod,
      totalMonthsStored: compounded.totalMonthsStored,
      return12M: {
        value: compounded.return12M.compoundedReturnPct,
        monthsUsed: compounded.return12M.monthsUsed,
        complete: compounded.return12M.complete,
      },
      return36M: {
        value: compounded.return36M.compoundedReturnPct,
        monthsUsed: compounded.return36M.monthsUsed,
        complete: compounded.return36M.complete,
      },
      return60M: {
        value: compounded.return60M.compoundedReturnPct,
        monthsUsed: compounded.return60M.monthsUsed,
        complete: compounded.return60M.complete,
      },
    });
  }

  return samples;
}

/**
 * Sync investment-track monthly returns from data.gov.il CKAN.
 * Does NOT update PensiaNetFund snapshot unless explicitly requested elsewhere.
 *
 * @param {{ dryRun?: boolean, resourceId?: string }} [opts]
 */
async function syncPensiaNetTrackMonthly(opts = {}) {
  const dryRun = Boolean(opts.dryRun);

  if (!config.enabled) {
    return {
      skipped: true,
      reason: 'PENSIANET_ENABLED=false',
      dryRun,
    };
  }

  const apiRecords = await fetchLatestDataset(opts);
  const { docs, report: validationReport } = validateAndMapTrackMonthlyRows(apiRecords);

  const writeStats = await upsertTrackMonthlyReturns(docs, { dryRun });

  const rejectionReasonsFormatted = Object.entries(validationReport.rejectionReasons).map(([code, count]) => ({
    code,
    label: REJECTION_LABELS[code] || code,
    count,
  }));

  const result = {
    dryRun,
    snapshotUpdated: false,
    rowsRead: validationReport.rowsRead,
    tracksIdentified: validationReport.tracksIdentified,
    recordsAdded: writeStats.upserted,
    recordsUpdated: writeStats.modified,
    recordsRejected: validationReport.rejected,
    rejectionReasons: rejectionReasonsFormatted,
    rejectedSamples: validationReport.rejectedSamples,
    unmatchedTracks: [],
    writeStats,
    syncedAt: new Date().toISOString(),
  };

  if (!dryRun && validationReport.tracksIdentified > 0) {
    const trackIdList = [...new Set(docs.map(d => d.trackId))];
    const withHistory = await PensiaNetMonthlyReturn.aggregate([
      { $match: { trackId: { $in: trackIdList.slice(0, 500) } } },
      { $group: { _id: '$trackId', count: { $sum: 1 } } },
      { $match: { count: { $lt: 12 } } },
      { $limit: 20 },
    ]);
    result.unmatchedTracks = withHistory.map(r => ({
      trackId: r._id,
      reason: 'insufficient_monthly_history',
      monthsStored: r.count,
    }));
  }

  return result;
}

/**
 * Pick 3 sample tracks with enough history for reporting.
 */
async function pickSampleTracksForReport(limit = 3) {
  const candidates = await PensiaNetMonthlyReturn.aggregate([
    { $match: { monthlyYield: { $ne: null } } },
    { $group: { _id: '$trackId', name: { $first: '$trackName' }, count: { $sum: 1 } } },
    { $match: { count: { $gte: 12 } } },
    { $sort: { count: -1 } },
    { $limit: limit * 5 },
  ]);

  return candidates.slice(0, limit).map(c => c._id);
}

module.exports = {
  validateAndMapTrackMonthlyRows,
  upsertTrackMonthlyReturns,
  syncPensiaNetTrackMonthly,
  sampleTrackCompoundedReturns,
  pickSampleTracksForReport,
  REJECTION_LABELS,
};
