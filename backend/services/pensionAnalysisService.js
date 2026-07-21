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
const { generateClearinghouseInsightRecommendations } = require('./pensionClearinghouseInsights');
const {
  runPensionRecommendationEngine,
  insightsToLegacyRecommendations,
} = require('./pensionRecommendationEngine');

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
 * @returns {Promise<object>}
 */
async function buildPensionAnalysis(userId) {
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

  const clearinghouseRecs = await generateClearinghouseInsightRecommendations(userId);
  const clearinghouseTypes = new Set(clearinghouseRecs.map(r => r.type));
  const recommendations = [
    ...clearinghouseRecs,
    ...baseRecommendations.filter(r => !clearinghouseTypes.has(r.type)),
  ].sort((a, b) => (b.impactAmount || 0) - (a.impactAmount || 0));

  const fundAdvice = await buildFundAdvice(summary.funds || [], {
    ...profile,
    currentAge: summary.currentAge,
    retirementAge: summary.retirementAge,
  });

  let structuredInsights = [];
  let insightMeta = null;
  try {
    const engineResult = await runPensionRecommendationEngine(userId, {
      summary,
      funds: summary.funds,
    });
    structuredInsights = engineResult.insights;
    insightMeta = engineResult.meta;

    const structuredLegacy = insightsToLegacyRecommendations(structuredInsights);
    const existingTypes = new Set(recommendations.map(r => r.type));
    for (const leg of structuredLegacy) {
      if (!existingTypes.has(leg.type)) {
        recommendations.push({
          type: leg.type,
          title: leg.title,
          reason: leg.reason,
          urgency: leg.urgency,
          financialImpact: leg.financialImpact,
          impactAmount: leg.impactAmount,
          confidenceScore: leg.confidenceScore,
        });
      }
    }
    recommendations.sort((a, b) => (b.impactAmount || 0) - (a.impactAmount || 0));
  } catch (err) {
    console.error('[buildPensionAnalysis] structured insights failed:', err.message);
  }

  // Gemel/study funds are owned by the gemel agent (gemelAnalysisService) —
  // getPensionSummary excludes them, so no gemel market pass runs here anymore.
  return {
    summary,
    projection: projection.available ? projection : null,
    benchmark,
    healthCheck,
    recommendations,
    structuredInsights,
    insightMeta,
    fundAdvice,
    profile,
  };
}

module.exports = { buildPensionAnalysis, EMPTY_BENCHMARK };
