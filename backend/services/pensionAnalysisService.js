'use strict';

/**
 * Unified pension analysis builder — reused by API, agent, risk-advice, email.
 */

const UserProfile = require('../models/UserProfile');
const {
  getPensionSummary,
  projectRetirementIncome,
  generatePensionRecommendations,
} = require('../ai/tools/pensionTools');
const { benchmarkPortfolio } = require('./pensionBenchmarkService');
const { runPensionHealthCheck } = require('./pensionHealthCheckService');
const { buildFundAdvice } = require('./pensionFundAdvisorService');
const PensionFund = require('../models/PensionFund');
const { generateClearinghouseInsightRecommendations } = require('./pensionClearinghouseInsights');
const {
  runPensionRecommendationEngine,
} = require('./pensionRecommendationEngine');
const { runFinancialAdvisoryAgent } = require('./financialAdvisory/runFinancialAdvisoryAgent');
const { fromPensionStructuredInsight } = require('../utils/financialInsightBuilder');
const { clearinghouseRecsToUnifiedInsights, filterClearinghouseRecsByDomain } = require('../utils/clearinghouseInsightBridge');
const {
  sanitizeFormattedRecommendation,
  sanitizePensionDisplayInsight,
  sanitizeBenchmarkForClient,
  sanitizeEvidenceForClient,
} = require('../utils/sanitizeClientInsights');

const EMPTY_BENCHMARK = {
  funds: [],
  summary: {
    totalPotentialSavings: 0,
    avgRankPercentile: null,
    fundsAboveMarketFee: 0,
    riskMismatchCount: 0,
    belowAverageCount: 0,
    issuesCount: 0,
    recommendedRiskLevel: null,
  },
};

/**
 * @param {string|import('mongoose').Types.ObjectId} userId
 * @param {object} [options]
 * @returns {Promise<object>}
 */
async function buildPensionAnalysis(userId, options = {}) {
  const [summary, profile] = await Promise.all([
    getPensionSummary(userId),
    UserProfile.findOne({ user: userId }).lean(),
  ]);

  const projection = projectRetirementIncome(summary);
  const benchmark = summary.funds?.length
    ? benchmarkPortfolio(summary.funds, {
      currentAge: summary.currentAge,
      retirementAge: summary.retirementAge,
      profile,
    })
    : EMPTY_BENCHMARK;

  const healthCheck = runPensionHealthCheck(summary, benchmark);
  const baseRecommendations = generatePensionRecommendations(summary, projection, {
    profile,
    benchmark,
  });

  const allClearinghouseRecs = await generateClearinghouseInsightRecommendations(userId);
  const clearinghouseRecs = filterClearinghouseRecsByDomain(allClearinghouseRecs, 'pension');
  const clearinghouseTypes = new Set(clearinghouseRecs.map(r => r.type));
  let recommendations = [
    ...clearinghouseRecs,
    ...baseRecommendations.filter(r => !clearinghouseTypes.has(r.type)),
  ]
    .filter(r => r.type !== 'no_study_fund')
    .sort((a, b) => (b.impactAmount || 0) - (a.impactAmount || 0));

  const fundAdvice = await buildFundAdvice(summary.funds || [], {
    ...profile,
    currentAge: summary.currentAge,
    retirementAge: summary.retirementAge,
  });

  let structuredInsights = [];
  let insightMeta = null;
  let advisoryEnvelope = null;

  try {
    const allFundsForAnalysis = await PensionFund.find({
      user: userId,
      status: { $ne: 'closed' },
    }).lean();

    const engineResult = await runPensionRecommendationEngine(userId, {
      summary,
      funds: allFundsForAnalysis,
    });
    structuredInsights = engineResult.insights;
    insightMeta = engineResult.meta;

    const engineUnified = structuredInsights.map(i => fromPensionStructuredInsight(i, 'PENSION'));
    const clearinghouseUnified = clearinghouseRecsToUnifiedInsights(
      clearinghouseRecs,
      allFundsForAnalysis,
      { domain: 'pension' },
    );
    const mergedUnified = [...clearinghouseUnified, ...engineUnified];

    advisoryEnvelope = await runFinancialAdvisoryAgent({
      userId,
      productType: 'PENSION',
      skipLLM: options.skipLLM,
      precomputed: {
        unifiedInsights: mergedUnified,
        engineMeta: engineResult.meta,
        matchResults: (engineResult.meta.marketMatches || []).map(m => ({
          matchConfidence: (m.matchConfidence ?? 0) * 100,
        })),
        rawStructured: structuredInsights,
      },
      legacyFields: {
        recommendationsForDisplay: recommendations,
        benchmark,
        healthCheck,
        fundAdvice,
        insightMeta,
      },
      summaryOverride: {
        totalProducts: allFundsForAnalysis.length,
        hasData: summary.hasData,
      },
    });
  } catch (err) {
    console.error('[buildPensionAnalysis] structured insights failed:', err.message);
  }

  const hasUnifiedRecs = (advisoryEnvelope?.primaryRecommendations?.length ?? 0) > 0;

  const displayPrimary = (advisoryEnvelope?.primaryRecommendations ?? []).map(rec => {
    const src = advisoryEnvelope?.centralRecommendations?.find(c => c.id === rec.insightId);
    return sanitizeFormattedRecommendation({
      ...rec,
      financialImpact: src?.financialImpact ?? rec.financialImpact ?? null,
      evidence: src?.evidence ?? rec.evidence ?? null,
    });
  });

  return {
    summary,
    projection: projection.available ? projection : null,
    benchmark,
    healthCheck,
    recommendations: hasUnifiedRecs ? [] : recommendations,
    structuredInsights: hasUnifiedRecs ? undefined : structuredInsights,
    insightMeta,
    fundAdvice,
    profile,
    productType: 'PENSION',
    ...(advisoryEnvelope ? {
      primaryRecommendations: displayPrimary,
      centralRecommendations: (advisoryEnvelope.centralRecommendations || []).map(c => ({
        ...c,
        evidence: sanitizeEvidenceForClient(c.evidence),
      })),
      positiveFindings: (advisoryEnvelope.positiveFindings || []).map(i => sanitizePensionDisplayInsight(unifiedToPensionDisplay(i))).filter(Boolean),
      additionalInsights: (advisoryEnvelope.additionalInsights || []).map(i => sanitizePensionDisplayInsight(unifiedToPensionDisplay(i))).filter(Boolean),
      secondaryInsights: advisoryEnvelope.secondaryInsights,
      marketData: advisoryEnvelope.marketData,
      dataQuality: advisoryEnvelope.dataQuality,
      missingData: advisoryEnvelope.missingData,
      llm: advisoryEnvelope.llm,
      analysisId: advisoryEnvelope.analysisId,
      disclaimer: advisoryEnvelope.disclaimer,
      productDisclaimer: advisoryEnvelope.productDisclaimer,
      prioritizationStats: advisoryEnvelope.summary?.prioritizationStats,
      llmSummary: advisoryEnvelope.llm?.summary,
    } : {}),
  };
}

function unifiedToPensionDisplay(ins) {
  if (!ins) return null;
  if (ins._legacy) return ins._legacy;
  return {
    id: ins.id,
    category: ins.code || ins.category,
    severity: ins.severity,
    title: ins.title,
    finding: ins.reason,
    recommendedAction: ins.suggestedAction,
    confidence: ins.confidence,
    benchmark: sanitizeBenchmarkForClient(ins.evidence?.benchmark),
    estimatedImpact: ins.financialImpact ? {
      annual: ins.financialImpact.period === 'annual' ? ins.financialImpact.amount : null,
      retirement: ins.financialImpact.period === 'retirement' ? ins.financialImpact.amount : null,
      currency: ins.financialImpact.currency || 'ILS',
    } : undefined,
    fundId: ins.productId ?? undefined,
  };
}

module.exports = { buildPensionAnalysis, EMPTY_BENCHMARK, unifiedToPensionDisplay };
