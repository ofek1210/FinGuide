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
const { buildGemelMarketAdvice } = require('./gemelNetAdvisorService');
const { generateClearinghouseInsightRecommendations } = require('./pensionClearinghouseInsights');

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

  const gemelProducts = (summary.funds || []).map(f => ({
    companyName: f.provider,
    productName: f.fundName,
    productType: f.fundType,
    totalSavings: f.currentBalance,
    depositFee: f.managementFeeDeposit != null
      ? (f.managementFeeDeposit < 0.05 ? f.managementFeeDeposit * 100 : f.managementFeeDeposit)
      : null,
    assetFee: f.managementFeeAccumulation != null
      ? (f.managementFeeAccumulation < 0.05 ? f.managementFeeAccumulation * 100 : f.managementFeeAccumulation)
      : null,
    status: 'פעיל',
  }));

  const gemelAdvice = await buildGemelMarketAdvice(gemelProducts, {
    ...profile,
    currentAge: summary.currentAge,
  });

  const govRecommendations = [];
  for (const f of gemelAdvice.funds || []) {
    if (f.verdict !== 'LEAVE') {
      govRecommendations.push({
        type: 'gemel_market',
        title: `גמל/השתלמות — ${f.verdictLabelHe}`,
        reason: f.summaryHe,
        urgency: f.verdict === 'SWITCH' ? 'high' : 'medium',
        financialImpact: f.annualSavingsEstimate
          ? `~₪${f.annualSavingsEstimate.toLocaleString('he-IL')}/שנה`
          : null,
        confidenceScore: 0.78,
      });
    }
  }

  return {
    summary,
    projection: projection.available ? projection : null,
    benchmark,
    healthCheck,
    recommendations: [...govRecommendations, ...recommendations],
    fundAdvice,
    gemelAdvice,
    profile,
  };
}

module.exports = { buildPensionAnalysis, EMPTY_BENCHMARK };
