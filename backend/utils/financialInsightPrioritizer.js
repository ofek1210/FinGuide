'use strict';

const config = require('../config/financialAdvisoryConfig');

const FEE_ISSUE_CODES = new Set([
  'net_return_estimate',
  'fee_cost_projection',
  'fee_cost_until_retirement',
  'net_return_after_fees',
  'high_asset_management_fee',
  'high_deposit_management_fee',
  'fees',
]);

const ALWAYS_INFORMATIONAL = new Set([
  'fund_size',
  'net_accumulation',
]);

function computePriority(ins) {
  let score = ins.priority ?? 50;
  const catBoost = config.categoryPriority[ins.category];
  if (catBoost != null) score = Math.min(score, catBoost * 10 + 5);
  const sevBoost = config.severityOrder[ins.severity];
  if (sevBoost != null) score = Math.min(score, sevBoost * 8);
  if (ins.confidence != null && ins.confidence < 0.5) score += 20;
  if (ins.financialImpact?.amount > 10000) score -= 5;
  return score;
}

function benchOf(ins) {
  return ins.evidence?.benchmark || {};
}

function isPositivePerformance(ins) {
  if (ins.code === 'performance_consistency') {
    const aboveRate = benchOf(ins).aboveMedianRate;
    const pct12 = benchOf(ins).percentile ?? benchOf(ins).compounded12MPercentile;
    if (aboveRate != null && aboveRate >= 60) return true;
    if (pct12 != null && pct12 >= 60 && ins.severity === 'info') return true;
    const finding = ins.reason || '';
    if (ins.severity === 'info' && /עקביות יחסית טובה|גבוהה יחסית|מעל חציון|מעל או ליד חציון/i.test(finding)) {
      return true;
    }
  }

  if (ins.code === 'fund_ranking' && ins.severity === 'info') {
    const retPct = benchOf(ins).compounded12MPercentile ?? benchOf(ins).percentile;
    const feePct = benchOf(ins).feePercentile;
    if (retPct != null && retPct >= 55 && (feePct == null || feePct < 70)) return true;
  }

  return false;
}

function isFeeRelated(ins) {
  return FEE_ISSUE_CODES.has(ins.code) || (ins.category === 'fees' && ins.code !== 'fund_ranking');
}

function feeIsActionable(ins) {
  if (!isFeeRelated(ins)) return false;
  const feePct = benchOf(ins).feePercentile;
  if (feePct != null && feePct >= 65) return true;
  if (['critical', 'high', 'medium'].includes(ins.severity)) return true;
  const amt = ins.financialImpact?.amount ?? 0;
  if (amt >= 500) return true;
  return ins.code === 'fee_cost_projection' || ins.code === 'net_return_estimate';
}

function mergeFeeInsights(feeInsights) {
  if (!feeInsights.length) return null;

  const sorted = [...feeInsights].sort(
    (a, b) => (config.severityOrder[a.severity] ?? 9) - (config.severityOrder[b.severity] ?? 9),
  );
  const primary = sorted[0];

  let annualCost = null;
  let retirementImpact = null;
  let assetFee = null;
  let depositFee = null;

  for (const ins of feeInsights) {
    const legacy = ins._legacy || {};
    const impact = ins.financialImpact || {};
    const ev = ins.evidence || legacy.benchmark || {};

    if (legacy.estimatedImpact?.annual != null) {
      annualCost = legacy.estimatedImpact.annual;
    } else if (impact.period === 'annual' && impact.amount != null) {
      annualCost = impact.amount;
    }

    if (legacy.estimatedImpact?.retirement != null) {
      retirementImpact = legacy.estimatedImpact.retirement;
    } else if (impact.period === 'retirement' && impact.amount != null) {
      retirementImpact = impact.amount;
    }

    if (assetFee == null && ev.assetManagementFee != null) assetFee = ev.assetManagementFee;
    if (depositFee == null && ev.depositManagementFee != null) depositFee = ev.depositManagementFee;
    if (assetFee == null && legacy.managementFeeAccumulation != null) {
      assetFee = legacy.managementFeeAccumulation <= 1
        ? legacy.managementFeeAccumulation * 100
        : legacy.managementFeeAccumulation;
    }
    if (depositFee == null && legacy.managementFeeDeposit != null) {
      depositFee = legacy.managementFeeDeposit <= 1
        ? legacy.managementFeeDeposit * 100
        : legacy.managementFeeDeposit;
    }
  }

  const fundName = primary.productName || primary._legacy?.title?.split('—').pop()?.trim();
  const reasonParts = [];
  if (benchOf(primary).feePercentile != null && benchOf(primary).feePercentile >= 65) {
    reasonParts.push('דמי הניהול בקרן שלך גבוהים יחסית למסלולים דומים.');
  } else {
    reasonParts.push('דמי הניהול בקרן שלך מעט גבוהים ביחס למסלולים דומים, והפער עשוי להצטבר לאורך זמן.');
  }

  return {
    ...primary,
    code: 'MANAGEMENT_FEES_REVIEW',
    category: 'fees',
    severity: primary.severity === 'info' ? 'medium' : primary.severity,
    priority: computePriority({ ...primary, severity: 'medium', category: 'fees' }),
    title: fundName ? `כדאי לבדוק את דמי הניהול — ${fundName}` : 'כדאי לבדוק את דמי הניהול',
    reason: reasonParts.join(' '),
    suggestedAction: 'כדאי לפנות לגוף המנהל ולבדוק אם ניתן לשפר את התנאים.',
    evidence: {
      ...(primary.evidence || {}),
      mergedFrom: feeInsights.map(i => i.code),
      assetManagementFee: assetFee,
      depositManagementFee: depositFee,
      estimatedAnnualCost: annualCost,
      estimatedRetirementImpact: retirementImpact,
    },
    financialImpact: (retirementImpact ?? annualCost) != null ? {
      amount: retirementImpact ?? annualCost,
      currency: 'ILS',
      period: retirementImpact != null ? 'retirement' : 'annual',
    } : primary.financialImpact,
    meta: {
      ...(primary.meta || {}),
      mergedCount: feeInsights.length,
    },
  };
}

function dedupeCentral(list) {
  const seen = new Set();
  const out = [];
  for (const ins of list) {
    const key = `${ins.code}:${ins.productId || 'portfolio'}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(ins);
  }
  out.sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));
  return out;
}

/**
 * Prioritize insights into user-facing groups.
 * @param {object[]} insights
 * @param {{ productType?: string }} [options]
 */
function prioritizeFinancialInsights(insights, options = {}) {
  const productType = options.productType || 'PENSION';
  const input = (insights || []).map(ins => ({ ...ins, priority: computePriority(ins) }));

  const feeBuckets = new Map();
  const centralRecommendations = [];
  const positiveFindings = [];
  const additionalInsights = [];
  const hiddenTechnicalInsights = [];

  for (const ins of input) {
    if (productType === 'PENSION') {
      if (ins.productType === 'GEMEL' || ins.productType === 'HISHTALMUT') continue;
      if (ins.legacyType === 'clearinghouse_high_fee_inactive_provident') continue;
    }
    if (productType === 'GEMEL' || productType === 'HISHTALMUT') {
      if (ins.productType === 'PENSION') continue;
      if (ins.legacyType === 'clearinghouse_small_inactive_pension') continue;
      if (ins.legacyType === 'clearinghouse_active_fee_benchmark') continue;
    }
    if (productType === 'PENSION' && (ins.code === 'no_study_fund' || ins.legacyType === 'no_study_fund')) {
      continue;
    }

    if (ALWAYS_INFORMATIONAL.has(ins.code)) {
      hiddenTechnicalInsights.push(ins);
      continue;
    }

    if (isFeeRelated(ins)) {
      if (feeIsActionable(ins)) {
        const key = `${ins.productId || 'portfolio'}:fees`;
        if (!feeBuckets.has(key)) feeBuckets.set(key, []);
        feeBuckets.get(key).push(ins);
      } else {
        hiddenTechnicalInsights.push(ins);
      }
      continue;
    }

    if (isPositivePerformance(ins)) {
      positiveFindings.push(ins);
      continue;
    }

    if (ins.code === 'fund_ranking') {
      if (ins.severity === 'medium' && benchOf(ins).percentile != null && benchOf(ins).percentile < 30) {
        centralRecommendations.push(ins);
      } else {
        additionalInsights.push(ins);
      }
      continue;
    }

    if (ins.code === 'asset_allocation') {
      if (['critical', 'high', 'medium'].includes(ins.severity)) {
        centralRecommendations.push(ins);
      } else {
        additionalInsights.push(ins);
      }
      continue;
    }

    if (ins.code === 'inactive_fund') {
      if (['critical', 'high', 'medium'].includes(ins.severity)) {
        centralRecommendations.push(ins);
      } else if (ins.severity === 'low') {
        centralRecommendations.push(ins);
      } else {
        additionalInsights.push(ins);
      }
      continue;
    }

    if (ins.severity === 'info' || ins.category === 'data_quality') {
      additionalInsights.push(ins);
      continue;
    }

    if (['critical', 'high', 'medium'].includes(ins.severity)) {
      centralRecommendations.push(ins);
      continue;
    }

    if (ins.severity === 'low') {
      additionalInsights.push(ins);
      continue;
    }

    additionalInsights.push(ins);
  }

  for (const feeGroup of feeBuckets.values()) {
    const merged = mergeFeeInsights(feeGroup);
    if (merged) centralRecommendations.push(merged);
  }

  let central = dedupeCentral(centralRecommendations);

  for (const ins of input) {
    if (!['critical', 'high'].includes(ins.severity)) continue;
    if (isFeeRelated(ins)) continue;
    const present = central.some(c =>
      c.id === ins.id || (c.productId === ins.productId && c.code === ins.code));
    if (!present) central.push(ins);
  }
  central = dedupeCentral(central);

  const mergedOrHidden = input.length - central.length - positiveFindings.length
    - additionalInsights.length;

  return {
    centralRecommendations: central,
    positiveFindings,
    additionalInsights,
    hiddenTechnicalInsights,
    primary: central,
    secondary: additionalInsights,
    additional: [...positiveFindings, ...hiddenTechnicalInsights],
    all: input,
    stats: {
      rawCount: input.length,
      centralCount: central.length,
      positiveCount: positiveFindings.length,
      additionalCount: additionalInsights.length,
      hiddenCount: hiddenTechnicalInsights.length,
      mergedOrHidden: Math.max(0, mergedOrHidden),
    },
  };
}

function mergeOverlappingInsights(insights) {
  return insights;
}

module.exports = {
  prioritizeFinancialInsights,
  mergeOverlappingInsights,
  computePriority,
  isPositivePerformance,
  mergeFeeInsights,
};
