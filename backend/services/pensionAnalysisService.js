/**
 * Unified pension analysis builder — reused by API, agent, risk-advice, email.
 */
'use strict';

const UserProfile = require('../models/UserProfile');
const {
  getPensionSummary,
  projectRetirementIncome,
  generatePensionRecommendations,
} = require('../ai/tools/pensionTools');
const { benchmarkPortfolio } = require('./pensionBenchmarkService');
const { runPensionHealthCheck } = require('./pensionHealthCheckService');

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
  const recommendations = generatePensionRecommendations(summary, projection, {
    profile,
    benchmark,
  });

  return {
    summary,
    projection: projection.available ? projection : null,
    benchmark,
    healthCheck,
    recommendations,
    profile,
  };
}

module.exports = { buildPensionAnalysis, EMPTY_BENCHMARK };
