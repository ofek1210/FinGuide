'use strict';

const { CARD_SLOTS } = require('./recommendationCardContract');

function cardToPrimaryRecommendation(card) {
  const altBlock = (card.alternatives || []).length
    ? `\n\nמסלולים להשוואה:\n${card.alternatives.map((a, i) =>
      `${i + 1}. ${a.fundName} (${a.managingCompany || ''}) — ${(a.reasons || []).join(' · ')}`,
    ).join('\n')}`
    : '';

  const metrics = card.metrics || {};
  const feeBlock = metrics.currentFeeBalancePct != null
    ? `\nדמי ניהול נוכחיים: ${metrics.currentFeeBalancePct}%`
    + (metrics.marketAverageFeeBalancePct != null ? `\nממוצע בשוק: ${metrics.marketAverageFeeBalancePct}%` : '')
    + (metrics.potentialAnnualSavingIls ? `\nחיסכון שנתי פוטנציאלי: ₪${metrics.potentialAnnualSavingIls.toLocaleString('he-IL')}` : '')
    : '';

  return {
    insightId: card.id,
    title: card.title,
    accountId: card.accountId || null,
    accountLabel: card.accountLabel || null,
    explanation: `${card.summary}${feeBlock}${altBlock}`.trim(),
    whyItMatters: card.why,
    nextStep: card.recommendation,
    confidence: card.confidence,
    confidenceLabelHe: card.confidenceLabelHe,
    cardSlot: card.slot,
    cardStatus: card.status,
    cardOutcome: card.cardOutcome,
    portfolioSelection: card.portfolioSelection || null,
    financialImpact: metrics.potentialAnnualSavingIls
      ? { amount: metrics.potentialAnnualSavingIls, period: 'annual', currency: 'ILS' }
      : null,
    evidence: {
      ...metrics,
      alternatives: card.alternatives,
      comparisonGroupLabel: metrics.comparisonGroupLabel,
    },
  };
}

function cardToCentralInsight(card) {
  return {
    id: card.id,
    code: card.slot,
    category: slotToCategory(card.slot),
    severity: cardStatusToSeverity(card),
    title: card.title,
    reason: card.summary,
    suggestedAction: card.recommendation,
    confidence: card.confidenceScore ?? 0.6,
    evidence: {
      ...card.metrics,
      why: card.why,
      status: card.status,
      alternatives: card.alternatives,
    },
    financialImpact: card.metrics?.potentialAnnualSavingIls
      ? { amount: card.metrics.potentialAnnualSavingIls, period: 'annual', currency: 'ILS' }
      : undefined,
    meta: {
      analyzerName: 'threeCardRecommendationEngine',
      cardSlot: card.slot,
      ruleVersion: '5.0.0',
    },
  };
}

function slotToCategory(slot) {
  switch (slot) {
    case CARD_SLOTS.MANAGEMENT_FEES: return 'fees';
    case CARD_SLOTS.TRACK_SUITABILITY: return 'risk';
    case CARD_SLOTS.MARKET_COMPARISON: return 'performance';
    default: return 'general';
  }
}

function cardStatusToSeverity(card) {
  if (card.confidence === 'insufficient_data') return 'info';
  if (card.slot === CARD_SLOTS.MANAGEMENT_FEES) {
    if (card.status === 'high') return 'high';
    if (card.status === 'above_average') return 'medium';
    return 'info';
  }
  if (card.slot === CARD_SLOTS.TRACK_SUITABILITY) {
    if (card.status === 'too_aggressive') return 'medium';
    if (card.status === 'too_conservative') return 'low';
    return 'info';
  }
  if (card.slot === CARD_SLOTS.MARKET_COMPARISON) {
    if (['bottom_peer_group', 'below_peer_median'].includes(card.status)) return 'medium';
    return 'info';
  }
  return 'info';
}

function cardsToPrimaryRecommendations(cards) {
  return (cards || []).map(cardToPrimaryRecommendation);
}

function cardsToCentralInsights(cards) {
  return (cards || []).map(cardToCentralInsight);
}

module.exports = {
  cardsToPrimaryRecommendations,
  cardsToCentralInsights,
  cardToPrimaryRecommendation,
};
