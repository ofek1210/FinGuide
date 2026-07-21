'use strict';

const PensiaNetFund = require('../models/PensiaNetFund');
const { normalizeFundRiskLevel } = require('../utils/pensionShared');
const config = require('../config/pensionAnalysisConfig');
const { computeTrackPerformanceAnalysis } = require('./pensiaNetMonthlyAnalysisService');

const FUND_TYPE_CLASSIFICATION = {
  pension_comprehensive: /פנסיה.*מקיפה|פנסיה חדשה|קרנות חדשות|קרנות כלליות/i,
  pension_old: /פנסיה.*ותיק|ותיקה|קרנות ותיקות/i,
  study_fund: /השתלמות/i,
  provident_fund: /קופת גמל|גמל/i,
  managers_insurance: /ביטוח מנהלים/i,
};

function normalizeText(s) {
  return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function classificationForFundType(fundType) {
  const pattern = FUND_TYPE_CLASSIFICATION[fundType] || FUND_TYPE_CLASSIFICATION.pension_comprehensive;
  return pattern;
}

/**
 * Match user fund to Pensia-Net row(s).
 * @param {object} fund — PensionFund lean doc
 * @returns {Promise<{ match: object|null, confidence: number, method: string }>}
 */
async function matchFundToPensiaNet(fund) {
  const classificationPattern = classificationForFundType(fund.fundType);
  const provider = normalizeText(fund.provider);
  const fundName = normalizeText(fund.fundName);
  const track = normalizeText(fund.investmentTrack);

  const candidates = await PensiaNetFund.find({
    SUG_KRN: classificationPattern,
    $or: [
      { SHM_TAAGID_MENAEL: new RegExp(fund.provider || '.', 'i') },
      { SHM_TAAGID_SHOLET: new RegExp(fund.provider || '.', 'i') },
    ],
  }).lean();

  if (!candidates.length) {
    return { match: null, confidence: 0, method: 'none' };
  }

  let best = null;
  let bestScore = 0;

  for (const row of candidates) {
    const rowName = normalizeText(row.SHM_KRN);
    let score = 0;
    if (provider && normalizeText(row.SHM_TAAGID_MENAEL).includes(provider)) score += 0.35;
    if (fundName && rowName.includes(fundName.split(' ')[0])) score += 0.25;
    if (track && rowName.includes(track.split(' ')[0])) score += 0.2;
    if (fundName && fundName.includes(rowName.split(' ')[0])) score += 0.15;

    const risk = normalizeFundRiskLevel(fund.riskLevel || fund.investmentTrack);
    const stockExp = row.CHSHIF_MNUIOT;
    if (stockExp != null && risk === 'high' && stockExp >= 50) score += 0.1;
    if (stockExp != null && risk === 'low' && stockExp < 35) score += 0.1;
    if (stockExp != null && risk === 'medium' && stockExp >= 35 && stockExp < 55) score += 0.1;

    if (score > bestScore) {
      bestScore = score;
      best = row;
    }
  }

  if (!best || bestScore < 0.25) {
    return { match: null, confidence: bestScore, method: 'low_confidence' };
  }

  return { match: formatPensiaRow(best), confidence: Math.min(1, bestScore), method: 'fuzzy_name' };
}

/**
 * Build peer group — same fund classification (SUG_KRN), comparable risk bucket.
 * @param {object} fund
 * @param {object|null} matchedMarketFund
 * @returns {Promise<{ groupKey: string, peers: object[], size: number }>}
 */
async function buildPeerGroup(fund, matchedMarketFund = null) {
  const classificationPattern = classificationForFundType(fund.fundType);
  const risk = normalizeFundRiskLevel(fund.riskLevel || fund.investmentTrack);

  const all = await PensiaNetFund.find({ SUG_KRN: classificationPattern }).lean();

  const peers = all.filter(row => {
    const stock = row.CHSHIF_MNUIOT;
    if (stock == null) return true;
    if (risk === 'high') return stock >= 45;
    if (risk === 'low') return stock < 35;
    return stock >= 30 && stock < 55;
  });

  const groupKey = `${fund.fundType}:${risk}:${matchedMarketFund?.classification || 'cohort'}`;

  return {
    groupKey,
    peers: peers.map(formatPensiaRow),
    size: peers.length,
  };
}

function formatPensiaRow(row) {
  return {
    id: row.ID,
    fundName: row.SHM_KRN,
    companyName: row.SHM_TAAGID_MENAEL || row.SHM_TAAGID_SHOLET || '',
    classification: row.SUG_KRN,
    depositFee: row.SHIUR_D_NIHUL_AHARON_HAFKADOT,
    assetFee: row.SHIUR_D_NIHUL_AHARON_TTVURAH ?? row.SHIUR_D_NIHUL_MEANUAL,
    return1Y: row.TSUA_12_HODASHIM ?? null,
    return3Y: row.TSUA_36_HODASHIM ?? null,
    return5Y: row.TSUA_SHNATIT_MEMUZAAT_5_SHANIM,
    standardDeviation36m: row.STIAT_TEKEN_36_HODASHIM,
    sharpeRatio: row.SHARPE_RATIO,
    alpha: row.ALPHA,
    stockExposure: row.CHSHIF_MNUIOT,
    foreignExposure: row.BETA_HUTZ_LAARETZ,
    totalAssets: row.YITRAT_NECHASIM,
    actuarialSurplus: row.ODEF_GIRAON_ACTUARI_LETKUFA,
    reportPeriod: row.TKUFAT_DUACH,
  };
}

async function loadRelevantMarketData(userId, funds) {
  void userId;
  const matches = [];
  for (const fund of funds || []) {
    const { match, confidence, method } = await matchFundToPensiaNet(fund);
    const peerGroup = await buildPeerGroup(fund, match);
    let trackPerformance = null;
    if (match?.id) {
      const peerIds = (peerGroup.peers || []).map(p => p.id).filter(Boolean);
      try {
        trackPerformance = await computeTrackPerformanceAnalysis(match.id, peerIds);
      } catch (err) {
        console.warn('[pensionMarketDataService] track performance failed:', err.message);
      }
    }
    matches.push({
      fundId: fund._id?.toString?.() || fund.id,
      fundName: fund.fundName,
      match,
      matchConfidence: confidence,
      matchMethod: method,
      peerGroup,
      trackPerformance,
      monthlyConsistency: trackPerformance?.monthlyConsistency ?? null,
      dataComplete: Boolean(match) && peerGroup.size >= config.minPeerGroupSize,
    });
  }
  return matches;
}

module.exports = {
  matchFundToPensiaNet,
  buildPeerGroup,
  loadRelevantMarketData,
  formatPensiaRow,
  classificationForFundType,
};
