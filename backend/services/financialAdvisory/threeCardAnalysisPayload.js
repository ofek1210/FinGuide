'use strict';

const {
  sanitizeFormattedRecommendation,
} = require('../../utils/sanitizeClientInsights');

function isThreeCardAnalysis(advisoryEnvelope) {
  return advisoryEnvelope?.recommendationEngine === 'three_card_v5'
    && Array.isArray(advisoryEnvelope.recommendationCards)
    && advisoryEnvelope.recommendationCards.length > 0;
}

function mapPrimaryRecommendations(advisoryEnvelope) {
  return (advisoryEnvelope?.primaryRecommendations ?? []).map(rec => {
    const src = advisoryEnvelope?.centralRecommendations?.find(c => c.id === rec.insightId);
    return sanitizeFormattedRecommendation({
      ...rec,
      financialImpact: src?.financialImpact ?? rec.financialImpact ?? null,
      evidence: src?.evidence ?? rec.evidence ?? null,
    });
  });
}

/**
 * Canonical client payload when three_card_v5 is active — single recommendation source.
 */
function buildThreeCardClientPayload({
  advisoryEnvelope,
  summary,
  projection = null,
  profile = null,
  productType,
}) {
  const displayPrimary = mapPrimaryRecommendations(advisoryEnvelope);

  return {
    summary,
    projection: projection?.available ? projection : (projection || null),
    profile,
    productType: productType || advisoryEnvelope.productType,
    recommendationEngine: 'three_card_v5',
    analysisId: advisoryEnvelope.analysisId,
    generatedAt: advisoryEnvelope.generatedAt,
    ruleVersion: advisoryEnvelope.ruleVersion,
    recommendationCards: advisoryEnvelope.recommendationCards,
    primaryRecommendations: displayPrimary,
    accountAnalyses: advisoryEnvelope.accountAnalyses ?? [],
    threeCardMeta: advisoryEnvelope.threeCardMeta ?? null,
    marketData: advisoryEnvelope.marketData,
    dataQuality: advisoryEnvelope.dataQuality,
    missingData: advisoryEnvelope.missingData ?? [],
    llm: advisoryEnvelope.llm,
    disclaimer: advisoryEnvelope.disclaimer,
    productDisclaimer: advisoryEnvelope.productDisclaimer,
  };
}

/** Sum annual savings from three-card primary recommendations (import snapshot fallback). */
function sumThreeCardAnnualSavings(analysis) {
  if (!isThreeCardAnalysis(analysis)) return 0;
  return (analysis.primaryRecommendations || []).reduce((sum, rec) => {
    const amount = rec.financialImpact?.period === 'annual' ? rec.financialImpact.amount : 0;
    return sum + (amount || 0);
  }, 0);
}

function extractImportSnapshotFields(analysis) {
  if (!isThreeCardAnalysis(analysis)) {
    return {
      totalPotentialSavings: analysis.benchmark?.summary?.totalPotentialSavings || 0,
      healthScore: analysis.healthCheck?.score ?? null,
      avgRankPercentile: analysis.benchmark?.summary?.avgRankPercentile ?? null,
      fundsAboveMarketFee: analysis.benchmark?.summary?.fundsAboveMarketFee || 0,
    };
  }

  const marketCard = (analysis.recommendationCards || []).find(c => c.slot === 'market_comparison');
  const highFeeAccounts = (analysis.accountAnalyses || []).filter(a => {
    const card = a.cards?.find(c => c.slot === 'management_fees');
    return card && ['high', 'above_average'].includes(card.status);
  }).length;

  return {
    totalPotentialSavings: sumThreeCardAnnualSavings(analysis),
    healthScore: null,
    avgRankPercentile: marketCard?.metrics?.userPercentile ?? null,
    fundsAboveMarketFee: highFeeAccounts,
  };
}

function buildUploadAnalysisSnippet(analysis) {
  if (!analysis) return null;
  if (isThreeCardAnalysis(analysis)) {
    return {
      summary: analysis.summary,
      projection: analysis.projection,
      recommendationEngine: analysis.recommendationEngine,
      recommendationCards: analysis.recommendationCards,
    };
  }
  return {
    summary: analysis.summary,
    benchmark: analysis.benchmark,
    projection: analysis.projection,
    healthCheck: analysis.healthCheck,
  };
}

module.exports = {
  isThreeCardAnalysis,
  mapPrimaryRecommendations,
  buildThreeCardClientPayload,
  sumThreeCardAnnualSavings,
  extractImportSnapshotFields,
  buildUploadAnalysisSnippet,
};
