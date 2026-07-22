'use strict';

const PensionFund = require('../models/PensionFund');
const { loadPensionUserContext } = require('./pensionUserProfileService');
const { loadRelevantMarketData } = require('./pensionMarketDataService');
const { analyzeFundRanking, analyzePerformanceConsistency } = require('./pensionBenchmarkAdvancedService');
const { analyzeReturnVsRisk } = require('./pensionRiskAnalysisService');
const { analyzeTrackFit } = require('./pensionTrackFitService');
const { analyzeAssetAllocation } = require('./pensionAllocationAnalysisService');
const { analyzeAccumulationAndSize } = require('./pensionAccumulationAnalysisService');
const { analyzeNetReturnAfterFees, analyzeFeeCostUntilRetirement } = require('./pensionFeeAnalysisService');
const { analyzeInactiveFunds } = require('./pensionInactiveFundAnalysisService');
const { analyzeContributions } = require('./pensionContributionAnalysisService');
const { analyzeCoverage } = require('./pensionCoverageAnalysisService');
const config = require('../config/pensionAnalysisConfig');

const PER_FUND_ANALYZERS = [
  analyzeFundRanking,
  analyzePerformanceConsistency,
  analyzeReturnVsRisk,
  analyzeTrackFit,
  analyzeAssetAllocation,
  analyzeAccumulationAndSize,
  analyzeNetReturnAfterFees,
  analyzeFeeCostUntilRetirement,
];

function stripLegacyWrapper(insight) {
  if (!insight) return null;
  const { legacy, ...structured } = insight;
  void legacy;
  return structured;
}

/**
 * Run full structured insight pipeline.
 * @param {string} userId
 * @param {object} [options] — { summary, funds, skipMarketData }
 * @returns {Promise<{ insights: object[], meta: object }>}
 */
async function runPensionRecommendationEngine(userId, options = {}) {
  const startedAt = Date.now();
  const funds = options.funds
    || await PensionFund.find({ user: userId }).lean();
  const userContext = await loadPensionUserContext(userId, options.summary);

  const insights = [];
  const meta = {
    fundCount: funds.length,
    analyzersRun: [],
    marketMatches: [],
    marketContexts: [],
    userContext,
    dataCompleteness: {},
    generatedAt: new Date().toISOString(),
    disclaimer: config.licensedAdvisorDisclaimer,
  };

  if (!funds.length) {
    return { insights, meta };
  }

  let marketContexts = [];
  if (!options.skipMarketData) {
    try {
      marketContexts = await loadRelevantMarketData(userId, funds);
      meta.marketMatches = marketContexts.map(m => ({
        fundId: m.fundId,
        matchConfidence: m.matchConfidence,
        dataComplete: m.dataComplete,
        peerGroupSize: m.peerGroup?.size ?? 0,
        compounded12MPercentile: m.trackPerformance?.peerBenchmark?.percentile12M ?? null,
        compounded12MReturn: m.trackPerformance?.compounded?.return12M?.compoundedReturnPct ?? null,
      }));
      meta.marketContexts = marketContexts;
    } catch (err) {
      console.error('[pensionRecommendationEngine] market data load failed:', err.message);
      meta.marketDataError = err.message;
    }
  }

  for (let i = 0; i < funds.length; i += 1) {
    const fund = funds[i];
    const marketCtx = marketContexts[i] || {};
    const ctx = {
      fundId: fund._id?.toString?.() || fund.id,
      userContext,
      match: marketCtx.match,
      peerGroup: marketCtx.peerGroup,
      matchConfidence: marketCtx.matchConfidence,
      trackPerformance: marketCtx.trackPerformance,
      monthlyConsistency: marketCtx.monthlyConsistency,
    };

    for (const analyzer of PER_FUND_ANALYZERS) {
      try {
        const results = analyzer(fund, ctx);
        const batch = Array.isArray(results) ? results : [];
        insights.push(...batch.map(stripLegacyWrapper).filter(Boolean));
        if (batch.length) meta.analyzersRun.push(analyzer.name);
      } catch (err) {
        console.error(`[pensionRecommendationEngine] ${analyzer.name} failed for ${fund.fundName}:`, err.message);
      }
    }
  }

  try {
    insights.push(...analyzeInactiveFunds(funds, userContext).map(stripLegacyWrapper));
    meta.analyzersRun.push('analyzeInactiveFunds');
  } catch (err) {
    console.error('[pensionRecommendationEngine] inactive funds:', err.message);
  }

  try {
    const contributionInsights = await analyzeContributions(userId, funds, userContext);
    insights.push(...contributionInsights.map(stripLegacyWrapper));
    if (contributionInsights.length) meta.analyzersRun.push('analyzeContributions');
  } catch (err) {
    console.error('[pensionRecommendationEngine] contributions:', err.message);
  }

  try {
    insights.push(...analyzeCoverage(funds, userContext).map(stripLegacyWrapper));
    meta.analyzersRun.push('analyzeCoverage');
  } catch (err) {
    console.error('[pensionRecommendationEngine] coverage:', err.message);
  }

  meta.dataCompleteness = {
    hasOnboardingProfile: Boolean(userContext.profile),
    hasAge: userContext.personal.age != null,
    hasRiskTolerance: Boolean(userContext.financial.riskTolerance),
    hasMaritalStatus: Boolean(userContext.personal.maritalStatus),
    marketMatchRate: marketContexts.filter(m => m.match).length / Math.max(funds.length, 1),
  };
  meta.durationMs = Date.now() - startedAt;

  const seen = new Set();
  const deduped = insights.filter(ins => {
    const key = `${ins.category}:${ins.title}:${ins.fundId || ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  deduped.sort((a, b) => {
    const sev = { high: 0, medium: 1, low: 2, info: 3 };
    return (sev[a.severity] ?? 4) - (sev[b.severity] ?? 4);
  });

  return { insights: deduped, meta };
}

/**
 * Map structured insights to legacy recommendation DTOs for backward compatibility.
 */
function insightsToLegacyRecommendations(insights) {
  return (insights || []).map(ins => ({
    type: ins.category,
    title: ins.title,
    reason: [ins.finding, ins.recommendedAction].filter(Boolean).join(' '),
    urgency: ins.severity === 'high' ? 'high' : ins.severity === 'medium' ? 'medium' : 'low',
    financialImpact: ins.estimatedImpact?.annual ?? ins.estimatedImpact?.retirement ?? null,
    impactAmount: ins.estimatedImpact?.retirement ?? ins.estimatedImpact?.annual ?? 0,
    confidenceScore: Math.round((ins.confidence ?? 0.7) * 100),
    structured: ins,
  }));
}

module.exports = {
  runPensionRecommendationEngine,
  insightsToLegacyRecommendations,
};
