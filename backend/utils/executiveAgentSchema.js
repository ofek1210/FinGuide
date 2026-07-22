'use strict';

/**
 * Standard structured output shape every specialist agent should expose.
 * @typedef {object} ExecutiveAgentStructuredOutput
 * @property {object[]} findings
 * @property {object[]} recommendations
 * @property {string} severity
 * @property {string} [estimatedImpact]
 * @property {number} confidence
 * @property {string[]} relatedEntities
 * @property {string} financialCategory
 * @property {number|null} possibleSavings
 * @property {string|null} possibleRisk
 */

function emptyStructuredOutput(overrides = {}) {
  return {
    findings: [],
    recommendations: [],
    severity: 'info',
    estimatedImpact: null,
    confidence: 0,
    relatedEntities: [],
    financialCategory: 'general',
    possibleSavings: null,
    possibleRisk: null,
    ...overrides,
  };
}

function structuredRecommendation({
  title,
  explanation,
  whyNow = null,
  whyItMatters = null,
  expectedBenefit = null,
  severity = 'medium',
  category = 'general',
  possibleSavings = null,
  possibleRisk = null,
  confidence = 0.7,
  relatedEntities = [],
  mergeKey = null,
  sourceId = null,
  sourceAgent = null,
  sourceReport = null,
  dataDate = null,
  itemKind = null,
  evidenceDeadline = null,
  currentState = null,
  steps = null,
  questionsForProvider = null,
}) {
  return {
    id: sourceId || `rec-${title?.slice(0, 24)}`,
    title,
    explanation: explanation || title,
    whyNow,
    whyItMatters: whyItMatters || whyNow,
    expectedBenefit,
    severity,
    financialCategory: category,
    possibleSavings,
    possibleRisk,
    confidence,
    relatedEntities,
    mergeKey,
    sourceAgent,
    sourceReport,
    dataDate,
    itemKind,
    evidenceDeadline,
    currentState,
    steps,
    questionsForProvider,
  };
}

module.exports = {
  emptyStructuredOutput,
  structuredRecommendation,
};
