'use strict';

const config = require('../config/pensionAnalysisConfig');
const { randomUUID } = require('crypto');

/**
 * Build a structured pension insight / recommendation.
 * @param {object} params
 * @returns {object}
 */
function buildPensionInsight({
  id,
  category,
  severity = 'info',
  title,
  finding,
  personalDataUsed = [],
  marketDataUsed = [],
  benchmark = {},
  estimatedImpact = {},
  recommendedAction,
  confidence = 0.7,
  assumptions = [],
  limitations = [],
  requiresLicensedAdvisor = true,
  fundId = null,
  legacyType = null,
  impactAmount = 0,
}) {
  const insight = {
    id: id || randomUUID(),
    category,
    severity,
    title,
    finding,
    personalDataUsed,
    marketDataUsed,
    benchmark: {
      group: benchmark.group ?? null,
      average: benchmark.average ?? null,
      median: benchmark.median ?? null,
      percentile: benchmark.percentile ?? null,
      ...benchmark,
    },
    estimatedImpact: {
      annual: estimatedImpact.annual ?? null,
      retirement: estimatedImpact.retirement ?? null,
      currency: estimatedImpact.currency || 'ILS',
    },
    recommendedAction: recommendedAction || '',
    confidence,
    assumptions,
    limitations,
    requiresLicensedAdvisor: Boolean(requiresLicensedAdvisor),
    disclaimer: config.licensedAdvisorDisclaimer,
  };

  if (fundId) insight.fundId = fundId;

  return {
    ...insight,
    /** Backward-compatible shape for existing UI / findings */
    legacy: {
      type: legacyType || category,
      title,
      reason: [finding, recommendedAction].filter(Boolean).join(' '),
      urgency: severity === 'high' ? 'high' : severity === 'medium' ? 'medium' : 'low',
      financialImpact: estimatedImpact.annual ?? estimatedImpact.retirement ?? null,
      impactAmount: impactAmount || estimatedImpact.annual || estimatedImpact.retirement || 0,
      confidenceScore: Math.round(confidence * 100),
    },
  };
}

module.exports = { buildPensionInsight };
