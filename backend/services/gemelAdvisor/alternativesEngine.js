'use strict';

const { ALTERNATIVE_WEIGHTS, MAX_ALTERNATIVES, MIN_MATCH_CONFIDENCE } = require('../../config/gemelAdvisorConfig');
const { median } = require('../../utils/pensionStats');

function scoreFeeCompetitiveness(candidate, peerMedianFee) {
  if (candidate.managementFeeBalanceAvgPct == null || peerMedianFee == null) return 50;
  const diff = peerMedianFee - candidate.managementFeeBalanceAvgPct;
  return Math.max(0, Math.min(100, 50 + diff * 20));
}

function scorePerformance(val, peerMedian) {
  if (val == null || peerMedian == null) return 50;
  const diff = val - peerMedian;
  return Math.max(0, Math.min(100, 50 + diff * 3));
}

function scoreDataQuality(fund) {
  let score = 40;
  if (fund.fundCode) score += 20;
  if (fund.return5YearsAnnualizedPct != null) score += 20;
  if (fund.managementFeeBalanceAvgPct != null) score += 10;
  if (fund.volatility != null || fund.sharpeRatio != null) score += 10;
  return Math.min(100, score);
}

function suitabilityScore(candidate, account, profile, match) {
  let score = 50;
  const riskOrder = { low: 0, medium: 1, high: 2, unknown: 1 };
  const userRisk = riskOrder[profile.riskTolerance] ?? 1;
  const fundRisk = riskOrder[candidate.riskLevel] ?? 1;
  const gap = Math.abs(userRisk - fundRisk);
  score += gap === 0 ? 25 : gap === 1 ? 10 : -15;

  if (profile.investmentHorizonYears != null && profile.investmentHorizonYears >= 10 && fundRisk >= 1) {
    score += 10;
  }
  if (profile.needsLiquiditySoon && fundRisk >= 2) score -= 20;
  if (!profile.canAbsorbLosses && fundRisk >= 2) score -= 25;
  if (candidate.productType !== account.productType && account.productType !== 'unknown') score -= 30;

  if (match?.matchedFundCode === candidate.fundCode) score -= 40;
  return Math.max(0, Math.min(100, score));
}

function buildReasons(candidate, scores, profile) {
  const reasons = [];
  if (scores.feeScore >= 70) reasons.push('דמי הניהול הממוצעים נמוכים יותר ביחס לקבוצת השוואה');
  if (scores.performanceScore >= 65) reasons.push('הציג ביצועים עקביים ביחס לקבוצת ההשוואה');
  if (scores.suitabilityScore >= 75) reasons.push('מתאים לטווח ההשקעה והפרופיל שצוין');
  if (!reasons.length) reasons.push('ניתן להשוות מול האפשרות הנוכחית');
  if (profile.missingFields.length) reasons.push('חלק מנתוני הפרופיל חסרים — ההשוואה חלקית');
  return reasons.slice(0, 3);
}

function buildTradeoffs(candidate, account, profile) {
  const tradeoffs = ['תשואות עבר אינן מבטיחות תשואה עתידית'];
  const riskOrder = { low: 0, medium: 1, high: 2, unknown: 1 };
  if ((riskOrder[candidate.riskLevel] ?? 1) > (riskOrder[account.rawRiskLevel || 'medium'] ?? 1)) {
    tradeoffs.unshift('רמת הסיכון גבוהה יותר מהמסלול הנוכחי — ייתכנו ירידות זמניות');
  }
  if (profile.needsLiquiditySoon) {
    tradeoffs.push('יש צורך בנזילות — כדאי לוודא תנאי משיכה לפני שינוי');
  }
  return tradeoffs.slice(0, 3);
}

/**
 * Rank alternatives for one account. Max 3. Never rank by return alone.
 */
function rankAlternatives(account, match, officialFunds, profile) {
  if (!match?.matchedFund || match.matchConfidence < MIN_MATCH_CONFIDENCE) {
    return [];
  }

  const peers = officialFunds.filter(f => {
    if (account.productType === 'study_fund') return f.productType === 'study_fund';
    return f.productType === 'gemel' || f.productType === 'investment_gemel';
  }).filter(f => f.fundCode !== match.matchedFundCode);

  const peerFees = peers.map(p => p.managementFeeBalanceAvgPct).filter(v => v != null);
  const peerRet5 = peers.map(p => p.return5YearsAnnualizedPct).filter(v => v != null);
  const peerRet3 = peers.map(p => p.return3YearsAnnualizedPct).filter(v => v != null);
  const medFee = median(peerFees);
  const medRet5 = median(peerRet5);
  const medRet3 = median(peerRet3);

  const scored = peers.map(candidate => {
    const suitability = suitabilityScore(candidate, account, profile, match);
    const feeScore = scoreFeeCompetitiveness(candidate, medFee);
    const performanceScore = scorePerformance(candidate.return5YearsAnnualizedPct, medRet5);
    const performance3Score = scorePerformance(candidate.return3YearsAnnualizedPct, medRet3);
    const consistencyScore = candidate.sharpeRatio != null
      ? Math.max(0, Math.min(100, 50 + candidate.sharpeRatio * 25))
      : 50;
    const dataQualityScore = scoreDataQuality(candidate);

    const overall = Math.round(
      suitability * ALTERNATIVE_WEIGHTS.suitability
      + feeScore * ALTERNATIVE_WEIGHTS.feeCompetitiveness
      + performanceScore * ALTERNATIVE_WEIGHTS.performance5Y
      + performance3Score * ALTERNATIVE_WEIGHTS.performance3Y
      + consistencyScore * ALTERNATIVE_WEIGHTS.consistency
      + dataQualityScore * ALTERNATIVE_WEIGHTS.dataQuality,
    );

    const scores = { suitabilityScore: suitability, feeScore, performanceScore, dataQualityScore };
    return {
      fundCode: candidate.fundCode,
      fundName: candidate.fundName,
      companyName: candidate.companyName,
      trackName: candidate.trackName,
      riskLevel: candidate.riskLevel,
      suitabilityScore: suitability,
      feeScore,
      performanceScore,
      dataQualityScore,
      overallAlternativeScore: overall,
      managementFeeBalanceAvgPct: candidate.managementFeeBalanceAvgPct,
      return5YearsAnnualizedPct: candidate.return5YearsAnnualizedPct,
      return3YearsAnnualizedPct: candidate.return3YearsAnnualizedPct,
      reasons: buildReasons(candidate, scores, profile),
      tradeoffs: buildTradeoffs(candidate, account, profile),
    };
  });

  return scored
    .sort((a, b) => b.overallAlternativeScore - a.overallAlternativeScore)
    .slice(0, MAX_ALTERNATIVES)
    .map((item, index) => ({ ...item, rank: index + 1 }));
}

module.exports = {
  rankAlternatives,
  suitabilityScore,
  scoreFeeCompetitiveness,
  scorePerformance,
};
