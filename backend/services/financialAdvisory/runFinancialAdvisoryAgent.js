'use strict';

const { randomUUID } = require('crypto');
const { runPensionRecommendationEngine } = require('../pensionRecommendationEngine');
const { runGemelRecommendationEngine } = require('../gemelRecommendationEngine');
const { fromPensionStructuredInsight } = require('../../utils/financialInsightBuilder');
const { prioritizeFinancialInsights } = require('../../utils/financialInsightPrioritizer');
const { getMarketDataMeta, enrichMarketWarnings } = require('./marketDataMetaService');
const { fromPensionMarketContext } = require('./productMatchingService');
const { formatFinancialInsightsWithLLM } = require('./llmInsightFormatter');
const { buildAdvisoryResponse, insightsToLegacyRecommendations } = require('./advisoryResponseBuilder');
const advisoryConfig = require('../../config/financialAdvisoryConfig');

function logInsightTrace({ analysisId, userId, productType, insights, llm, marketData }) {
  for (const ins of insights || []) {
    console.info('[financialAdvisory]', JSON.stringify({
      analysisId,
      userId: String(userId),
      productType,
      insightCode: ins.code,
      analyzerName: ins.meta?.analyzerName,
      ruleVersion: ins.meta?.ruleVersion || advisoryConfig.ruleVersion,
      severity: ins.severity,
      confidence: ins.confidence,
      marketPeriod: marketData?.latestReportPeriod,
      llmUsed: llm?.used,
      llmProvider: llm?.provider,
      fallbackUsed: llm?.fallbackUsed,
    }));
  }
}

async function runDeterministicEngine(userId, productType, options = {}) {
  if (productType === 'PENSION') {
    const { insights, meta } = await runPensionRecommendationEngine(userId, options);
    const unified = (insights || []).map(i => fromPensionStructuredInsight(i, 'PENSION'));
    const matchResults = (meta.marketMatches || []).map(m => ({
      matchConfidence: m.compounded12MPercentile != null ? m.matchConfidence * 100 : (m.matchConfidence ?? 0) * 100,
    }));
    return { unifiedInsights: unified, engineMeta: meta, matchResults, rawStructured: insights };
  }

  const filter = productType === 'HISHTALMUT' ? 'HISHTALMUT' : productType === 'GEMEL' ? 'GEMEL' : null;
  const { insights, meta, missingData } = await runGemelRecommendationEngine(userId, {
    ...options,
    productTypeFilter: filter,
  });
  return {
    unifiedInsights: insights,
    engineMeta: meta,
    matchResults: meta.marketMatches || [],
    missingData: missingData || [],
    rawStructured: insights,
  };
}

/**
 * Shared financial advisory orchestrator.
 * @param {object} params
 * @param {string} params.userId
 * @param {'PENSION'|'GEMEL'|'HISHTALMUT'} params.productType
 * @param {boolean} [params.skipLLM=false]
 * @param {object} [params.options] — passed to product engine
 * @param {object} [params.legacyFields] — backward-compatible fields to merge
 * @param {object} [params.summaryOverride] — summary stats
 */
async function runFinancialAdvisoryAgent({
  userId,
  productType,
  skipLLM = false,
  options = {},
  precomputed = null,
  legacyFields = {},
  summaryOverride = {},
}) {
  const analysisId = randomUUID();

  const marketMeta = await getMarketDataMeta(productType);
  const engineResult = precomputed
    ? {
      unifiedInsights: precomputed.unifiedInsights || [],
      engineMeta: precomputed.engineMeta || {},
      matchResults: precomputed.matchResults || [],
      missingData: precomputed.missingData || [],
      rawStructured: precomputed.rawStructured || precomputed.unifiedInsights,
    }
    : await runDeterministicEngine(userId, productType, options);
  const marketData = enrichMarketWarnings(marketMeta, engineResult.matchResults);

  const prioritized = prioritizeFinancialInsights(engineResult.unifiedInsights, { productType });

  const { formatted, llm } = await formatFinancialInsightsWithLLM({
    productType,
    structuredInsights: prioritized.centralRecommendations,
    marketDataPeriod: marketData.latestReportPeriod,
    skipLLM,
  });

  if (process.env.NODE_ENV !== 'production') {
    console.log('[financialAdvisory]', {
      llmUsed: llm.used,
      provider: llm.provider,
      fallbackUsed: llm.fallbackUsed,
      inputInsightCount: prioritized.stats?.rawCount ?? engineResult.unifiedInsights.length,
      outputRecommendationCount: formatted.primaryRecommendations?.length ?? 0,
      centralCount: prioritized.centralRecommendations.length,
      mergedOrHidden: prioritized.stats?.mergedOrHidden ?? 0,
    });
  }

  logInsightTrace({
    analysisId,
    userId,
    productType,
    insights: prioritized.all,
    llm,
    marketData,
  });

  const avgMatch = engineResult.matchResults.length
    ? Math.round(engineResult.matchResults.reduce((s, m) => s + (m.matchConfidence ?? 0), 0) / engineResult.matchResults.length)
    : null;

  const response = buildAdvisoryResponse({
    productType,
    structuredInsights: prioritized.all,
    prioritized,
    formatted,
    marketData,
    dataQuality: {
      uploadValid: true,
      matchConfidence: avgMatch,
      missingFields: (engineResult.missingData || []).map(m => m.field),
      warnings: marketData.warnings || [],
    },
    summary: {
      totalProducts: engineResult.engineMeta?.fundCount ?? summaryOverride.totalProducts ?? 0,
      positiveFindings: prioritized.positiveFindings.length,
      prioritizationStats: prioritized.stats,
      ...summaryOverride,
    },
    missingData: engineResult.missingData || [],
    llm,
    legacyFields: {
      ...legacyFields,
      recommendations: legacyFields.recommendationsForDisplay ?? legacyFields.recommendations ?? [],
      insightMeta: engineResult.engineMeta,
    },
  });

  response.analysisId = analysisId;
  return response;
}

module.exports = {
  runFinancialAdvisoryAgent,
  runDeterministicEngine,
};
