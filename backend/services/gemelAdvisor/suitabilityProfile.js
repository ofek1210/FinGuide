'use strict';

const { loadPensionUserContext } = require('../pensionUserProfileService');

const RISK_MAP = {
  conservative: 'low',
  moderate: 'medium',
  balanced: 'medium',
  aggressive: 'high',
  low: 'low',
  medium: 'medium',
  high: 'high',
};

function normalizeRiskTolerance(val) {
  if (!val) return null;
  const key = String(val).toLowerCase();
  return RISK_MAP[key] || null;
}

/**
 * Build normalized suitability profile from onboarding — age is one factor, not override.
 */
async function buildSuitabilityProfile(userId, summary = null) {
  const ctx = await loadPensionUserContext(userId, summary);
  const missingFields = [];

  if (ctx.personal.age == null) missingFields.push('age');
  if (!ctx.financial.riskTolerance) missingFields.push('riskTolerance');

  const horizonYears = ctx.retirement.yearsToRetirement;
  const needsLiquiditySoon = ctx.financial.monthlyExpensesEstimate != null
    && ctx.financial.savingsEstimate != null
    && ctx.financial.savingsEstimate < ctx.financial.monthlyExpensesEstimate * 3;

  let goal = 'long_term_growth';
  if (ctx.retirement.hasStudyFund === false && summary?.hasStudyFund) goal = 'study_fund_review';
  if (needsLiquiditySoon) goal = 'liquidity_priority';

  const riskTolerance = normalizeRiskTolerance(ctx.financial.riskTolerance) || ctx.risk.fromAge;
  const canAbsorbLosses = riskTolerance === 'high'
    || (riskTolerance === 'medium' && !needsLiquiditySoon && (horizonYears == null || horizonYears >= 7));

  const filled = ['age', 'riskTolerance', 'investmentHorizonYears'].filter(f => !missingFields.includes(f));
  const profileConfidence = missingFields.length === 0 ? 0.85
    : missingFields.length === 1 ? 0.65 : 0.45;

  return {
    age: ctx.personal.age,
    riskTolerance: riskTolerance || 'unknown',
    investmentExperience: ctx.profile?.financial?.investmentExperience || 'unknown',
    investmentHorizonYears: horizonYears,
    needsLiquiditySoon,
    hasEmergencyFund: ctx.financial.savingsEstimate != null
      && ctx.financial.monthlyExpensesEstimate != null
      && ctx.financial.savingsEstimate >= ctx.financial.monthlyExpensesEstimate * 3,
    goal,
    canAbsorbLosses,
    profileConfidence,
    missingFields,
    raw: {
      maritalStatus: ctx.personal.maritalStatus,
      employmentStatus: ctx.employment.status,
      grossSalary: ctx.employment.grossSalary,
    },
  };
}

module.exports = { buildSuitabilityProfile, normalizeRiskTolerance };
