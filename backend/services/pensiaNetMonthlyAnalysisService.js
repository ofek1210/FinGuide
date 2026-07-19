'use strict';

const PensiaNetMonthlyReturn = require('../models/PensiaNetMonthlyReturn');
const { buildCompoundedWindows } = require('../utils/pensiaNetCompounding');
const { median, percentileRank } = require('../utils/pensionStats');
const config = require('../config/pensionAnalysisConfig');

function trackKey(row) {
  return String(row.trackId || row.fundId);
}

function groupRowsByTrack(rows) {
  const map = new Map();
  for (const row of rows) {
    const id = trackKey(row);
    if (!map.has(id)) map.set(id, []);
    map.get(id).push(row);
  }
  for (const [id, list] of map) {
    list.sort((a, b) => b.reportPeriod - a.reportPeriod);
    map.set(id, list.slice(0, 60));
  }
  return map;
}

function averageYields(series) {
  const vals = (series || []).map(s => s.yield).filter(v => v != null);
  if (!vals.length) return null;
  return vals.reduce((s, v) => s + v, 0) / vals.length;
}

function getPeriodCutoff(months) {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - months, 1);
  return d.getFullYear() * 100 + (d.getMonth() + 1);
}

/**
 * Load monthly returns for a track, newest first.
 */
async function loadFundMonthlyReturns(fundId, limit = 60) {
  const trackId = String(fundId);
  return PensiaNetMonthlyReturn.find({
    $or: [{ trackId }, { fundId: trackId }],
    monthlyYield: { $ne: null },
  })
    .sort({ reportPeriod: -1 })
    .limit(limit)
    .lean();
}

/**
 * Month-by-month vs peer median (legacy helper).
 */
async function computeMonthlyConsistency(fundId, peerFundIds, months = 12) {
  if (!fundId || !peerFundIds?.length) return null;

  const allIds = [String(fundId), ...peerFundIds.map(String)];
  const since = getPeriodCutoff(months);

  const rows = await PensiaNetMonthlyReturn.find({
    $or: [{ trackId: { $in: allIds } }, { fundId: { $in: allIds } }],
    reportPeriod: { $gte: since },
    monthlyYield: { $ne: null },
  }).lean();

  if (!rows.length) return null;

  const byPeriod = new Map();
  for (const row of rows) {
    if (!byPeriod.has(row.reportPeriod)) byPeriod.set(row.reportPeriod, []);
    byPeriod.get(row.reportPeriod).push(row);
  }

  let above = 0;
  let below = 0;
  let compared = 0;
  const userSeries = [];
  const peerIdSet = new Set(peerFundIds.map(String));

  for (const [period, periodRows] of [...byPeriod.entries()].sort((a, b) => b[0] - a[0])) {
    const userRow = periodRows.find(r => trackKey(r) === String(fundId));
    const peerYields = periodRows
      .filter(r => peerIdSet.has(trackKey(r)) && trackKey(r) !== String(fundId))
      .map(r => r.monthlyYield)
      .filter(v => v != null);

    if (!userRow || peerYields.length < config.minPeerGroupSize) continue;

    const med = median(peerYields);
    if (med == null) continue;

    compared += 1;
    if (userRow.monthlyYield >= med) above += 1;
    else below += 1;
    userSeries.push({ period, yield: userRow.monthlyYield, peerMedian: med });
  }

  if (compared < 3) return null;

  const recent = userSeries.slice(0, Math.min(12, userSeries.length));
  const older = userSeries.slice(12, Math.min(36, userSeries.length));
  const recentAvg = averageYields(recent);
  const olderAvg = averageYields(older);

  let trend = 'stable';
  if (recentAvg != null && olderAvg != null) {
    if (recentAvg > olderAvg + 0.15) trend = 'improving';
    else if (recentAvg < olderAvg - 0.15) trend = 'declining';
  }

  return {
    months,
    monthsCompared: compared,
    monthsAboveMedian: above,
    monthsBelowMedian: below,
    aboveMedianRate: compared ? Math.round((above / compared) * 100) : null,
    trend,
    recentAvgMonthlyYield: recentAvg,
    olderAvgMonthlyYield: olderAvg,
  };
}

/**
 * Full track performance profile: compounded 12/36/60M + peer benchmark + monthly consistency.
 * @param {string} trackId — official Pensia-Net FUND_ID
 * @param {string[]} peerTrackIds
 */
async function computeTrackPerformanceAnalysis(trackId, peerTrackIds) {
  if (!trackId) return null;

  const peerIds = (peerTrackIds || []).map(String).filter(id => id !== String(trackId));
  const allIds = [String(trackId), ...peerIds];

  const rows = await PensiaNetMonthlyReturn.find({
    $or: [{ trackId: { $in: allIds } }, { fundId: { $in: allIds } }],
    monthlyYield: { $ne: null },
  }).lean();

  if (!rows.length) return null;

  const byTrack = groupRowsByTrack(rows);
  const userRows = byTrack.get(String(trackId));
  if (!userRows?.length) return null;

  const userWindows = buildCompoundedWindows(userRows);

  const peer12 = [];
  const peer36 = [];
  const peer60 = [];
  for (const pid of peerIds) {
    const peerRows = byTrack.get(pid);
    if (!peerRows?.length) continue;
    const w = buildCompoundedWindows(peerRows);
    if (w.return12M.complete) peer12.push(w.return12M.compoundedReturnPct);
    if (w.return36M.complete) peer36.push(w.return36M.compoundedReturnPct);
    if (w.return60M.complete) peer60.push(w.return60M.compoundedReturnPct);
  }

  const monthlyConsistency = await computeMonthlyConsistency(trackId, peerIds, 12);

  const user12 = userWindows.return12M.compoundedReturnPct;
  const user36 = userWindows.return36M.compoundedReturnPct;
  const user60 = userWindows.return60M.compoundedReturnPct;

  return {
    trackId: String(trackId),
    lastReportDate: userWindows.lastReportDate,
    lastReportPeriod: userWindows.lastReportPeriod,
    totalMonthsStored: userWindows.totalMonthsStored,
    compounded: {
      return12M: userWindows.return12M,
      return36M: userWindows.return36M,
      return60M: userWindows.return60M,
    },
    peerBenchmark: {
      median12M: peer12.length ? median(peer12) : null,
      median36M: peer36.length ? median(peer36) : null,
      median60M: peer60.length ? median(peer60) : null,
      peerCount12M: peer12.length,
      peerCount36M: peer36.length,
      peerCount60M: peer60.length,
      percentile12M: user12 != null && peer12.length >= config.minPeerGroupSize
        ? percentileRank(user12, peer12)
        : null,
      percentile36M: user36 != null && peer36.length >= config.minPeerGroupSize
        ? percentileRank(user36, peer36)
        : null,
      percentile60M: user60 != null && peer60.length >= config.minPeerGroupSize
        ? percentileRank(user60, peer60)
        : null,
    },
    monthlyConsistency,
  };
}

module.exports = {
  loadFundMonthlyReturns,
  computeMonthlyConsistency,
  computeTrackPerformanceAnalysis,
};
