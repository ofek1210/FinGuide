'use strict';

const { CONFIDENCE_LEVELS } = require('./recommendationCardContract');
const advisoryConfig = require('../../../config/financialAdvisoryConfig');

/**
 * Map numeric score (0–1) and qualitative factors to a public confidence label.
 */
function resolveConfidenceLevel(score, { blockers = [] } = {}) {
  if (blockers.length) return CONFIDENCE_LEVELS.INSUFFICIENT_DATA;
  if (score == null || Number.isNaN(score)) return CONFIDENCE_LEVELS.INSUFFICIENT_DATA;
  if (score >= 0.78) return CONFIDENCE_LEVELS.HIGH;
  if (score >= 0.55) return CONFIDENCE_LEVELS.MEDIUM;
  return CONFIDENCE_LEVELS.LOW;
}

function confidenceLabelHe(level) {
  switch (level) {
    case CONFIDENCE_LEVELS.HIGH: return 'רמת ביטחון גבוהה';
    case CONFIDENCE_LEVELS.MEDIUM: return 'רמת ביטחון בינונית';
    case CONFIDENCE_LEVELS.LOW: return 'רמת ביטחון נמוכה';
    default: return 'נתונים לא מספיקים';
  }
}

/**
 * Shared confidence inputs used across all three cards.
 */
function buildBaseConfidenceFactors({
  userContext,
  matchConfidence,
  comparisonGroupCertain = true,
  hasReturnHistory = true,
  marketFresh = true,
}) {
  const blockers = [];
  let score = 0.5;

  if (userContext?.personal?.age == null) blockers.push('missing_age');
  else score += 0.1;

  if (userContext?.financial?.riskTolerance) score += 0.15;
  else score += 0.05;

  if (matchConfidence != null) {
    const pct = matchConfidence > 1 ? matchConfidence : matchConfidence * 100;
    if (pct < advisoryConfig.matchConfidence.weakMin) blockers.push('weak_market_match');
    else if (pct >= advisoryConfig.matchConfidence.strongMin) score += 0.2;
    else if (pct >= advisoryConfig.matchConfidence.acceptableMin) score += 0.12;
    else score += 0.05;
  } else {
    blockers.push('no_market_match');
  }

  if (!comparisonGroupCertain) {
    score -= 0.1;
    blockers.push('uncertain_comparison_group');
  }

  if (!hasReturnHistory) {
    score -= 0.15;
    blockers.push('insufficient_return_history');
  }

  if (!marketFresh) score -= 0.08;

  return {
    score: Math.min(1, Math.max(0, score)),
    blockers,
    level: resolveConfidenceLevel(score, { blockers }),
    labelHe: confidenceLabelHe(resolveConfidenceLevel(score, { blockers })),
  };
}

module.exports = {
  resolveConfidenceLevel,
  confidenceLabelHe,
  buildBaseConfidenceFactors,
};
