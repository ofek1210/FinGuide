'use strict';

const { randomUUID } = require('crypto');
const config = require('../../config/financialAdvisoryConfig');

/**
 * Build unified advisory API envelope with backward-compatible fields.
 */
function buildAdvisoryResponse({
  productType,
  structuredInsights = [],
  prioritized = {},
  formatted,
  marketData = {},
  dataQuality = {},
  summary = {},
  missingData = [],
  llm = {},
  legacyFields = {},
}) {
  const analysisId = randomUUID();
  const generatedAt = new Date().toISOString();

  const central = prioritized.centralRecommendations || prioritized.primary || [];
  const positiveFindings = prioritized.positiveFindings || [];
  const additionalInsights = prioritized.additionalInsights || prioritized.secondary || [];
  const hiddenTechnicalInsights = prioritized.hiddenTechnicalInsights || [];

  const primaryIssues = central.filter(i => ['critical', 'high', 'medium'].includes(i.severity)).length;

  const disclaimer = productType === 'PENSION'
    ? config.disclaimers.pension
    : config.disclaimers.gemel;

  const envelope = {
    success: true,
    productType,
    analysisId,
    generatedAt,
    ruleVersion: config.ruleVersion,
    marketData,
    dataQuality,
    summary: {
      totalProducts: summary.totalProducts ?? 0,
      primaryIssues,
      positiveFindings: positiveFindings.length,
      prioritizationStats: prioritized.stats ?? null,
      ...summary,
    },
    centralRecommendations: central,
    positiveFindings,
    additionalInsights,
    hiddenTechnicalInsights,
    primaryRecommendations: (formatted?.primaryRecommendations || []).map(rec => {
      const src = central.find(c => c.id === rec.insightId);
      return {
        ...rec,
        financialImpact: src?.financialImpact ?? rec.financialImpact ?? null,
        evidence: src?.evidence ?? rec.evidence ?? null,
      };
    }),
    secondaryInsights: additionalInsights,
    additionalInsightsLegacy: [...positiveFindings, ...hiddenTechnicalInsights],
    structuredInsights,
    missingData,
    llm: {
      used: Boolean(llm.used),
      provider: llm.provider ?? null,
      fallbackUsed: Boolean(llm.fallbackUsed),
      reason: llm.reason ?? null,
      summary: formatted?.summary || null,
    },
    disclaimer: config.disclaimers.general,
    productDisclaimer: disclaimer,
  };

  if (legacyFields.recommendations) envelope.recommendations = legacyFields.recommendations;
  if (legacyFields.insightMeta) envelope.insightMeta = legacyFields.insightMeta;
  if (legacyFields.benchmark) envelope.benchmark = legacyFields.benchmark;
  if (legacyFields.healthCheck) envelope.healthCheck = legacyFields.healthCheck;
  if (legacyFields.fundAdvice) envelope.fundAdvice = legacyFields.fundAdvice;
  if (legacyFields.marketAdvice) envelope.marketAdvice = legacyFields.marketAdvice;
  if (legacyFields.payslipFindings) envelope.payslipFindings = legacyFields.payslipFindings;
  if (legacyFields.projection) envelope.projection = legacyFields.projection;
  if (legacyFields.profile) envelope.profile = legacyFields.profile;
  if (legacyFields.summaryDto) envelope.summary = { ...envelope.summary, ...legacyFields.summaryDto };

  return envelope;
}

function insightsToLegacyRecommendations(insights) {
  return (insights || []).map(ins => ({
    type: ins.code || ins.category,
    title: ins.title,
    reason: [ins.reason, ins.suggestedAction].filter(Boolean).join(' '),
    urgency: ins.severity === 'critical' || ins.severity === 'high' ? 'high'
      : ins.severity === 'medium' ? 'medium' : 'low',
    financialImpact: ins.financialImpact?.amount ?? null,
    impactAmount: ins.financialImpact?.amount ?? 0,
    confidenceScore: Math.round((ins.confidence ?? 0.7) * 100),
    insightId: ins.id,
    structured: ins,
  }));
}

module.exports = {
  buildAdvisoryResponse,
  insightsToLegacyRecommendations,
};
