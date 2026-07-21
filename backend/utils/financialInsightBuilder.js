'use strict';

const { randomUUID } = require('crypto');
const config = require('../config/financialAdvisoryConfig');

const SEVERITY_MAP = {
  high: 'high',
  medium: 'medium',
  low: 'low',
  info: 'info',
  critical: 'critical',
  warning: 'medium',
};

const CATEGORY_MAP = {
  fund_ranking: 'performance',
  performance_consistency: 'performance',
  return_vs_risk: 'risk',
  track_fit: 'risk',
  asset_allocation: 'risk',
  net_return_after_fees: 'fees',
  fee_cost_until_retirement: 'fees',
  inactive_fund: 'account_structure',
  contribution_gap: 'deposits',
  deposit_mismatch: 'deposits',
  survivor_coverage_fit: 'coverage',
  disability_coverage: 'coverage',
  data_quality: 'data_quality',
  liquidity_status: 'liquidity',
  fragmented_accounts: 'account_structure',
};

/**
 * Build unified financial insight contract.
 * @param {object} params
 * @returns {object}
 */
function buildFinancialInsight({
  id,
  code,
  productType,
  category,
  severity = 'info',
  priority = 50,
  title,
  reason,
  suggestedAction,
  evidence = {},
  financialImpact,
  confidence = 0.7,
  productId = null,
  productName = null,
  sourceDate = null,
  sources = [],
  disclaimers = [],
  analyzerName = null,
  ruleVersion = config.ruleVersion,
  legacy = null,
}) {
  const normalizedSeverity = SEVERITY_MAP[severity] || 'info';
  const normalizedCategory = CATEGORY_MAP[category] || category || 'data_quality';

  const insight = {
    id: id || randomUUID(),
    code: code || category || 'insight',
    productType,
    category: normalizedCategory,
    severity: normalizedSeverity,
    priority,
    title,
    reason,
    suggestedAction: suggestedAction || '',
    evidence,
    confidence,
    productId,
    productName,
    sourceDate,
    sources,
    disclaimers,
    meta: {
      analyzerName,
      ruleVersion,
      generatedAt: new Date().toISOString(),
    },
  };

  if (financialImpact) {
    insight.financialImpact = {
      amount: financialImpact.amount ?? null,
      currency: financialImpact.currency || 'ILS',
      period: financialImpact.period ?? null,
      assumptions: financialImpact.assumptions || [],
    };
  }

  if (legacy) insight._legacy = legacy;

  return insight;
}

/**
 * Map legacy pension structured insight → unified contract.
 */
function fromPensionStructuredInsight(ins, productType = 'PENSION') {
  return buildFinancialInsight({
    id: ins.id,
    code: ins.category,
    productType,
    category: ins.category,
    severity: ins.severity,
    priority: ins.severity === 'high' ? 10 : ins.severity === 'medium' ? 30 : 60,
    title: ins.title,
    reason: ins.finding,
    suggestedAction: ins.recommendedAction,
    evidence: {
      personalDataUsed: ins.personalDataUsed || [],
      marketDataUsed: ins.marketDataUsed || [],
      benchmark: ins.benchmark || {},
      limitations: ins.limitations || [],
      assumptions: ins.assumptions || [],
    },
    financialImpact: ins.estimatedImpact ? {
      amount: ins.estimatedImpact.retirement ?? ins.estimatedImpact.annual ?? null,
      currency: ins.estimatedImpact.currency || 'ILS',
      period: ins.estimatedImpact.retirement != null ? 'retirement' : 'annual',
      assumptions: ins.assumptions || [],
    } : undefined,
    confidence: ins.confidence ?? 0.7,
    productId: ins.fundId ?? null,
    productName: null,
    sources: [...(ins.personalDataUsed || []), ...(ins.marketDataUsed || [])],
    disclaimers: ins.disclaimer ? [ins.disclaimer] : [],
    analyzerName: ins.category,
    legacy: ins,
  });
}

module.exports = {
  buildFinancialInsight,
  fromPensionStructuredInsight,
  CATEGORY_MAP,
};
