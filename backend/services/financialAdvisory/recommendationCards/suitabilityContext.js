'use strict';

const { normalizeFundRiskLevel } = require('../../../utils/pensionShared');
const { normalizeRiskTolerance } = require('../../gemelAdvisor/suitabilityProfile');

/**
 * Product-specific investment horizon and suitability inputs.
 *
 * userRisk: onboarding riskTolerance when present; otherwise null (never age-only for actionable recs).
 * suitableRiskRange: derived from horizon + goal + liquidity — NOT pension retirement for gemel/hishtalmut.
 */
function resolveProductKind(productType, fund) {
  if (productType === 'PENSION') return 'pension';
  if (productType === 'HISHTALMUT' || fund?.fundType === 'study_fund') return 'hishtalmut';
  if (fund?.fundType === 'investment_gemel' || fund?.productType === 'investment_gemel') return 'investment_gemel';
  return 'gemel';
}

function readSmartAnswer(profile, path) {
  const agents = profile?.smartOnboarding?.agents;
  if (agents?.get) return agents.get(path.split('.')[0])?.answers?.[path];
  const general = profile?.smartOnboarding?.general?.answers || {};
  const gemel = profile?.insuranceOnboarding?.answers || {};
  return general[path] ?? gemel[path] ?? null;
}

function yearsUntilDate(isoDate) {
  if (!isoDate) return null;
  const target = new Date(isoDate);
  if (Number.isNaN(target.getTime())) return null;
  const diffMs = target.getTime() - Date.now();
  return diffMs / (365.25 * 24 * 3600 * 1000);
}

function buildSuitabilityContext({ userContext, fund, productType }) {
  const profile = userContext?.profile || {};
  const personal = userContext?.personal || {};
  const financial = userContext?.financial || {};
  const productKind = resolveProductKind(productType, fund);

  const age = personal.age ?? null;
  const onboardingRisk = normalizeRiskTolerance(financial.riskTolerance);
  const lossReaction = readSmartAnswer(profile, 'lossReaction')
    || profile?.financial?.lossReaction
    || null;
  const liquidityNeed = readSmartAnswer(profile, 'liquidityNeed')
    || (financial.savingsEstimate != null && financial.monthlyExpensesEstimate != null
      && financial.savingsEstimate < financial.monthlyExpensesEstimate * 3 ? 'high' : null);

  let horizonYears = null;
  let horizonSource = null;
  let primaryGoal = null;
  let plannedWithdrawalYears = null;

  if (productKind === 'pension') {
    horizonYears = userContext?.retirement?.yearsToRetirement ?? null;
    horizonSource = 'retirement_profile';
    primaryGoal = 'retirement';
  } else if (productKind === 'hishtalmut') {
    const liquidityDate = fund?.rawData?.liquidityDate || fund?.rawData?.expectedLiquidityDate;
    plannedWithdrawalYears = readSmartAnswer(profile, 'gemel.liquidityHorizonYears')
      ?? yearsUntilDate(liquidityDate);
    horizonYears = plannedWithdrawalYears;
    horizonSource = liquidityDate ? 'fund_liquidity_date' : 'onboarding_or_unknown';
    primaryGoal = readSmartAnswer(profile, 'gemel.primaryGoal') || 'study_fund_savings';
  } else if (productKind === 'investment_gemel') {
    plannedWithdrawalYears = readSmartAnswer(profile, 'gemel.investmentHorizonYears') ?? null;
    horizonYears = plannedWithdrawalYears;
    horizonSource = 'investment_horizon';
    primaryGoal = readSmartAnswer(profile, 'gemel.primaryGoal') || 'long_term_savings';
  } else {
    plannedWithdrawalYears = readSmartAnswer(profile, 'gemel.horizonYears') ?? null;
    horizonYears = plannedWithdrawalYears ?? userContext?.retirement?.yearsToRetirement ?? null;
    horizonSource = plannedWithdrawalYears ? 'gemel_horizon' : 'fallback_retirement_only_if_missing';
    primaryGoal = readSmartAnswer(profile, 'gemel.primaryGoal') || 'provident_savings';
  }

  const userRisk = onboardingRisk || null;
  const suitableRiskRange = computeSuitableRiskRange({
    productKind,
    age,
    horizonYears,
    primaryGoal,
    liquidityNeed,
    lossReaction,
    userRisk,
  });

  const blockers = [];
  if (!userRisk) blockers.push('missing_risk_tolerance');
  if (age == null) blockers.push('missing_age');
  if (productKind !== 'pension' && horizonYears == null) blockers.push('missing_product_horizon');
  if (liquidityNeed === 'high' || (plannedWithdrawalYears != null && plannedWithdrawalYears <= 2)) {
    blockers.push('near_term_withdrawal');
  }
  if (lossReaction === 'sell' || lossReaction === 'very_uncomfortable') blockers.push('low_loss_capacity');
  if (liquidityNeed === 'high') blockers.push('high_liquidity_need');

  return {
    productKind,
    age,
    userRisk,
    userRiskSource: onboardingRisk ? 'onboarding' : 'missing',
    suitableRiskRange,
    suitableRiskRangeExplanation: suitableRiskRange.explanationHe,
    horizonYears,
    horizonSource,
    primaryGoal,
    plannedWithdrawalYears,
    lossReaction,
    liquidityNeed,
    incomeStability: userContext?.employment?.status || null,
    hasEmergencyFund: financial.savingsEstimate != null && financial.monthlyExpensesEstimate != null
      && financial.savingsEstimate >= financial.monthlyExpensesEstimate * 3,
    blockers,
    fundRisk: normalizeFundRiskLevel(fund?.riskLevel || fund?.investmentTrack),
  };
}

function computeSuitableRiskRange({
  productKind, age, horizonYears, primaryGoal, liquidityNeed, lossReaction, userRisk,
}) {
  let min = 'low';
  let max = 'high';
  const factors = [];

  if (horizonYears != null && horizonYears <= 3) {
    max = 'low';
    factors.push('אופק קצר — טווח חיסכון עד 3 שנים');
  } else if (horizonYears != null && horizonYears <= 7) {
    max = 'medium';
    factors.push('אופק בינוני — 3–7 שנים');
  } else if (horizonYears != null && horizonYears > 15) {
    min = 'medium';
    factors.push('אופק ארוך — מעל 15 שנים');
  }

  if (productKind === 'pension' && horizonYears != null && horizonYears > 20) {
    min = 'medium';
    factors.push('פנסיה — שנים רבות עד פרישה');
  }

  if (liquidityNeed === 'high' || (horizonYears != null && horizonYears <= 2)) {
    max = 'low';
    factors.push('צורך נזילות / משיכה קרובה');
  }

  if (lossReaction === 'sell' || lossReaction === 'very_uncomfortable') {
    max = max === 'high' ? 'medium' : max;
    factors.push('תגובה לירידות — מגבילה חשיפה');
  }

  if (userRisk) {
    factors.push(`העדפת סיכון מהפרופיל: ${userRisk}`);
  }

  const explanationHe = factors.length
    ? factors.join(' · ')
    : 'טווח מתאים מחושב לפי סוג מוצר, אופק ונזילות — לא רק לפי גיל.';

  return { min, max, explanationHe, productKind };
}

function isRiskWithinRange(fundRisk, range) {
  const order = { low: 0, medium: 1, high: 2, unknown: null };
  const f = order[fundRisk];
  if (f == null) return null;
  return f >= order[range.min] && f <= order[range.max];
}

module.exports = {
  buildSuitabilityContext,
  computeSuitableRiskRange,
  isRiskWithinRange,
  resolveProductKind,
};
