'use strict';

/** Insights where financialImpact is monthly — annualize ×12 */
const MONTHLY_IMPACT_IDS = new Set([
  'pension_rate_low',
  'pension_employer_low',
]);

/** Tax-related savings — count once (max), not sum of overlapping estimates */
const TAX_SAVINGS_IDS = new Set([
  'tax_credit_gap',
  'annual_tax_refund_estimate',
]);

/** Annual gap insights — financialImpact already yearly */
const ANNUAL_GAP_IDS = new Set([
  'study_fund_underutilized',
  'study_fund_missing',
]);

function annualizeInsightImpact(insight) {
  const amount = insight?.financialImpact;
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  if (MONTHLY_IMPACT_IDS.has(insight.id)) return amount * 12;
  return amount;
}

/**
 * Sum only recoverable gaps (tax overpayment, pension shortfall, study fund upside).
 * Ignores informational insights and mandatory deductions (NI, health, gross→net).
 */
function computeRecoverableSavingsAnnual(insights) {
  const list = Array.isArray(insights) ? insights : [];

  const taxCandidates = list
    .filter(i => TAX_SAVINGS_IDS.has(i.id))
    .map(annualizeInsightImpact)
    .filter(n => n > 0);
  const taxSavings = taxCandidates.length ? Math.max(...taxCandidates) : 0;

  const gapSavings = list
    .filter(i => MONTHLY_IMPACT_IDS.has(i.id) || ANNUAL_GAP_IDS.has(i.id))
    .reduce((sum, i) => sum + annualizeInsightImpact(i), 0);

  return Math.round(taxSavings + gapSavings);
}

module.exports = {
  MONTHLY_IMPACT_IDS,
  TAX_SAVINGS_IDS,
  ANNUAL_GAP_IDS,
  annualizeInsightImpact,
  computeRecoverableSavingsAnnual,
};
