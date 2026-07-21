'use strict';

const GemelNetFund = require('../models/GemelNetFund');
const { normalizeFundRiskLevel } = require('../utils/pensionShared');
const pensionConfig = require('../config/pensionAnalysisConfig');
const advisoryConfig = require('../config/financialAdvisoryConfig');
const { buildProductMatchResult } = require('./financialAdvisory/productMatchingService');

function normalizeText(s) {
  return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function formatGemelRow(row) {
  if (!row) return null;
  return {
    id: String(row.ID),
    fundName: row.SHM_KRN,
    companyName: row.SHM_TAAGID_MENAEL || row.SHM_TAAGID_SHOLET || '',
    classification: row.SUG_KRN,
    depositFee: row.SHIUR_D_NIHUL_AHARON_HAFKADOT ?? row.SHIUR_D_NIHUL_MEANUAL ?? null,
    assetFee: row.SHIUR_D_NIHUL_AHARON_TTVURAH ?? row.SHIUR_D_NIHUL_MEANUAL ?? null,
    return1Y: row.TSUA_12_HODASHIM ?? null,
    return5Y: row.TSUA_SHNATIT_MEMUZAAT_5_SHANIM,
    standardDeviation36m: row.STIAT_TEKEN_36_HODASHIM,
    sharpeRatio: row.SHARPE_RATIO,
    alpha: row.ALPHA,
    stockExposure: row.CHSHIF_MNUIOT,
    reportPeriod: row.TKUFAT_DUACH,
  };
}

function cohortFilterForFund(fund) {
  if (fund.fundType === 'study_fund') return /השתלמות/i;
  return /גמל|תגמול/i;
}

async function matchFundToGemelNet(fund) {
  const provider = normalizeText(fund.provider);
  const fundName = normalizeText(fund.fundName);
  const track = normalizeText(fund.investmentTrack);
  const classification = cohortFilterForFund(fund);

  const candidates = await GemelNetFund.find({
    SUG_KRN: classification,
    $or: [
      { SHM_TAAGID_MENAEL: new RegExp(fund.provider || '.', 'i') },
      { SHM_TAAGID_SHOLET: new RegExp(fund.provider || '.', 'i') },
    ],
  }).lean();

  if (!candidates.length) {
    return buildProductMatchResult({ matchConfidence: 0, matchMethod: 'none', missingFields: ['market_match'] });
  }

  let best = null;
  let bestScore = 0;
  for (const row of candidates) {
    const rowName = normalizeText(row.SHM_KRN);
    let score = 0;
    if (provider && normalizeText(row.SHM_TAAGID_MENAEL).includes(provider)) score += 0.35;
    if (fundName && rowName.includes(fundName.split(' ')[0])) score += 0.25;
    if (track && rowName.includes(track.split(' ')[0])) score += 0.2;
    if (score > bestScore) {
      bestScore = score;
      best = row;
    }
  }

  const confidencePct = Math.round(Math.min(1, bestScore) * 100);
  if (!best || bestScore < 0.25) {
    return buildProductMatchResult({
      matchConfidence: confidencePct,
      matchMethod: 'low_confidence',
      missingFields: ['market_match'],
    });
  }

  const formatted = formatGemelRow(best);
  return {
    ...buildProductMatchResult({
      matchedProductId: formatted.id,
      matchedProductName: formatted.fundName,
      matchConfidence: confidencePct,
      matchMethod: 'fuzzy_name',
      matchedFields: ['provider', 'fundName', 'fundType'],
      comparisonGroup: `${fund.fundType}:${normalizeFundRiskLevel(fund.riskLevel || fund.investmentTrack)}`,
    }),
    match: formatted,
  };
}

async function buildPeerGroup(fund, matchedMarketFund) {
  const classification = cohortFilterForFund(fund);
  const peers = await GemelNetFund.find({
    SUG_KRN: classification,
    TSUA_SHNATIT_MEMUZAAT_5_SHANIM: { $ne: null },
  }).limit(200).lean();

  const risk = normalizeFundRiskLevel(fund.riskLevel || fund.investmentTrack);
  const filtered = peers.filter(p => {
    const exp = p.CHSHIF_MNUIOT;
    if (exp == null) return true;
    if (risk === 'high') return exp >= 45;
    if (risk === 'low') return exp < 35;
    return exp >= 30 && exp < 55;
  });

  const list = (filtered.length >= pensionConfig.minPeerGroupSize ? filtered : peers)
    .map(formatGemelRow)
    .filter(Boolean);

  return {
    groupKey: `${fund.fundType}:${risk}:gemelnet`,
    peers: list.slice(0, 50),
    size: list.length,
  };
}

async function loadRelevantGemelMarketData(userId, funds) {
  void userId;
  const matches = [];
  for (const fund of funds || []) {
    const productMatch = await matchFundToGemelNet(fund);
    const peerGroup = productMatch.match
      ? await buildPeerGroup(fund, productMatch.match)
      : { groupKey: null, peers: [], size: 0 };

    matches.push({
      fundId: fund._id?.toString?.() || fund.id,
      fundName: fund.fundName,
      fundType: fund.fundType,
      match: productMatch.match ?? null,
      productMatch,
      peerGroup,
      matchConfidence: productMatch.matchConfidence / 100,
      dataComplete: Boolean(productMatch.match) && peerGroup.size >= pensionConfig.minPeerGroupSize
        && productMatch.allowPeerRanking,
    });
  }
  return matches;
}

module.exports = {
  matchFundToGemelNet,
  buildPeerGroup,
  loadRelevantGemelMarketData,
  formatGemelRow,
};
