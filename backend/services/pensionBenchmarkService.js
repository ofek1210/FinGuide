/**
 * Pension benchmark & ranking vs market (FINQ-style).
 * Matches user funds to static track table and computes percentile, fee status, savings.
 */



const { calculateMgmtFeeSavings } = require('../ai/engines/calculationEngine');
const { getMarketAverage, getTracksByCohort, TOP_QUARTILE, TRACKS } = require('../config/pensionBenchmarkTables');
const {
  DEFAULT_MARKET_MGMT_FEE,
  recommendedRiskLevel,
  resolveRetirementAge,
  normalizeFundRiskLevel,
} = require('../utils/pensionShared');

function normalizeText(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^\u0590-\u05FFa-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenOverlap(a, b) {
  const ta = new Set(normalizeText(a).split(' ').filter(Boolean));
  const tb = new Set(normalizeText(b).split(' ').filter(Boolean));
  if (ta.size === 0 || tb.size === 0) return 0;
  let overlap = 0;
  for (const t of ta) {
    if (tb.has(t)) overlap += 1;
  }
  return overlap / Math.max(ta.size, tb.size);
}

/**
 * Match fund to benchmark track.
 * @returns {{ track, confidence, matchMethod }}
 */
function matchFundToTrack(fund) {
  const fundText = normalizeText(`${fund.provider || ''} ${fund.fundName || ''} ${fund.investmentTrack || ''}`);
  const risk = fund.riskLevel || 'medium';
  const cohort = getTracksByCohort(fund.fundType || 'other', risk);
  const searchPool = cohort.length > 0 ? cohort : TRACKS;

  let best = null;
  let bestScore = 0;

  for (const track of searchPool) {
    const trackText = normalizeText(`${track.provider} ${track.name}`);
    let score = tokenOverlap(fundText, trackText);
    if (fund.provider && normalizeText(fund.provider).includes(normalizeText(track.provider))) score += 0.3;
    if (fund.investmentTrack && normalizeText(fund.investmentTrack).includes(normalizeText(track.name))) score += 0.2;
    if (normalizeText(fund.fundName || '').includes(normalizeText(track.name))) score += 0.25;
    if (score > bestScore) {
      bestScore = score;
      best = track;
    }
  }

  if (!best || bestScore < 0.25) {
    const fallback = getMarketAverage(fund.fundType || 'other', fund.riskLevel || 'medium');
    return {
      track: null,
      marketAvg: fallback,
      confidence: bestScore,
      matchMethod: 'market_avg_only',
    };
  }

  return {
    track: best,
    marketAvg: getMarketAverage(best.productType, best.riskLevel),
    confidence: Math.min(1, bestScore),
    matchMethod: 'fuzzy',
  };
}

function feeStatus(fee, marketAvgFee) {
  if (fee == null || marketAvgFee == null) return 'unknown';
  if (fee <= TOP_QUARTILE.mgmtFeeAccumulation) return 'excellent';
  if (fee <= marketAvgFee * 1.05) return 'fair';
  if (fee <= marketAvgFee * 1.25) return 'above_market';
  return 'high';
}

function returnPercentile(fundReturn, cohortTracks) {
  if (fundReturn == null || !cohortTracks.length) return null;
  const returns = cohortTracks.map(t => t.return1Y).sort((a, b) => a - b);
  const below = returns.filter(r => r <= fundReturn).length;
  return Math.round((below / returns.length) * 100);
}

function rankLabel(percentile) {
  if (percentile == null) return 'unknown';
  if (percentile >= 75) return 'above_average';
  if (percentile >= 40) return 'average';
  return 'below_average';
}

/**
 * Benchmark all funds for a user portfolio.
 * @param {object[]} funds - PensionFund lean docs
 * @param {object} profile - UserProfile or summary slice { currentAge, retirementAge }
 */
function benchmarkPortfolio(funds, profile = {}) {
  const age = profile.currentAge ?? profile.personal?.age ?? null;
  const retirementAge = profile.retirementAge ?? resolveRetirementAge(profile);
  const yearsToRetirement = age != null ? Math.max(0, retirementAge - age) : null;
  const recommendedRisk = recommendedRiskLevel(age, yearsToRetirement);

  const activeFunds = (funds || []).filter(f => f.status !== 'closed' && f.isActive !== false);
  const fundResults = [];
  let totalPotentialSavings = 0;
  let feesAboveMarket = 0;
  let riskMismatches = 0;
  let belowAverageTracks = 0;

  for (const fund of activeFunds) {
    const match = matchFundToTrack(fund);
    const cohort = match.track
      ? getTracksByCohort(match.track.productType, match.track.riskLevel)
      : getTracksByCohort(fund.fundType || 'other', fund.riskLevel || 'medium');

    const fundReturn = match.track?.return1Y ?? null;
    const percentile = match.track
      ? Math.max(5, Math.min(95, 100 - (match.track.rank || 50)))
      : null;

    const fee = fund.managementFeeAccumulation;
    const marketFee = match.marketAvg?.mgmtFeeAccumulation ?? DEFAULT_MARKET_MGMT_FEE;
    const feeStat = feeStatus(fee, marketFee);
    if (feeStat === 'above_market' || feeStat === 'high') feesAboveMarket += 1;

    const currentRisk = normalizeFundRiskLevel(fund.riskLevel || match.track?.riskLevel || 'medium');
    const riskMismatch = recommendedRisk
      && currentRisk !== 'unknown'
      && currentRisk !== recommendedRisk;
    if (riskMismatch) riskMismatches += 1;

    const rank = rankLabel(percentile);
    if (rank === 'below_average') belowAverageTracks += 1;

    let savingsEstimate = 0;
    if (fee != null && fee > TOP_QUARTILE.mgmtFeeAccumulation && yearsToRetirement > 0) {
      const monthlyContrib = (fund.monthlyEmployeeDeposit || 0) + (fund.monthlyEmployerDeposit || 0);
      const { savingsByRetirement } = calculateMgmtFeeSavings(
        fund.currentBalance || 0,
        monthlyContrib,
        yearsToRetirement,
        fee,
        TOP_QUARTILE.mgmtFeeAccumulation,
      );
      savingsEstimate = savingsByRetirement;
      totalPotentialSavings += savingsEstimate;
    }

    fundResults.push({
      fundId: fund._id?.toString?.() || fund.id,
      fundName: fund.fundName,
      provider: fund.provider,
      fundType: fund.fundType,
      matchedTrack: match.track
        ? { id: match.track.id, name: match.track.name, provider: match.track.provider, rank: match.track.rank }
        : null,
      matchConfidence: Math.round((match.confidence || 0) * 100),
      marketRankPercentile: percentile,
      rankLabel: rank,
      feeVsMarket: feeStat,
      marketAvgFee: marketFee,
      userFee: fee,
      return1Y: fundReturn,
      riskLevel: currentRisk,
      recommendedRiskLevel: recommendedRisk,
      riskMismatch: Boolean(riskMismatch),
      potentialSavingsToRetirement: savingsEstimate,
    });
  }

  const avgRank = fundResults.length
    ? Math.round(fundResults.reduce((s, f) => s + (f.marketRankPercentile || 50), 0) / fundResults.length)
    : null;

  return {
    funds: fundResults,
    summary: {
      totalPotentialSavings,
      avgRankPercentile: avgRank,
      fundsAboveMarketFee: feesAboveMarket,
      riskMismatchCount: riskMismatches,
      belowAverageCount: belowAverageTracks,
      issuesCount: feesAboveMarket + riskMismatches + belowAverageTracks,
      recommendedRiskLevel: recommendedRisk,
    },
  };
}

module.exports = {
  benchmarkPortfolio,
  matchFundToTrack,
  feeStatus,
};
