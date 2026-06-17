/**
 * Explanation Agent
 *
 * Converts technical results into simple Hebrew explanations.
 * Adds confidence scores and action items.
 */

'use strict';

const { buildExplanationSystemPrompt } = require('../prompts/explanationPrompt');
const { askClaude } = require('../../services/claudeChatService');

/**
 * Simplify a technical recommendation into plain Hebrew.
 * @param {object} recommendation - RecommendationDTO
 * @returns {Promise<ExplainedRecommendationDTO>}
 */
async function explainRecommendation(recommendation) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      ...recommendation,
      simpleExplanation: recommendation.reason,
      actionSteps: [],
    };
  }

  try {
    const systemPrompt = buildExplanationSystemPrompt();
    const userMsg = `הסבר את ההמלצה הבאה בשפה פשוטה:\n${JSON.stringify(recommendation)}`;
    const result = await askClaude(userMsg, systemPrompt, []);
    return {
      ...recommendation,
      simpleExplanation: result?.answer || recommendation.reason,
      actionSteps: [],
    };
  } catch {
    return {
      ...recommendation,
      simpleExplanation: recommendation.reason,
      actionSteps: [],
    };
  }
}

/**
 * Generate a summary of agent results in plain Hebrew.
 * @param {object} mergedResults
 * @returns {Promise<string>}
 */
async function generateHebSummary(mergedResults) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return buildFallbackSummary(mergedResults);
  }

  try {
    const systemPrompt = buildExplanationSystemPrompt();
    const userMsg = [
      'סכם את מצב המשתמש בשני משפטים קצרים בעברית פשוטה:',
      JSON.stringify(mergedResults, null, 2),
    ].join('\n');
    const result = await askClaude(userMsg, systemPrompt, []);
    return result?.answer || buildFallbackSummary(mergedResults);
  } catch {
    return buildFallbackSummary(mergedResults);
  }
}

function buildFallbackSummary(results) {
  const parts = [];
  if (results.payslip?.status === 'success') {
    parts.push(`תלושים: ${results.payslip.data?.payslipCount || 0} מנותחים`);
  }
  if (results.insurance?.data?.duplicateCount > 0) {
    parts.push(`ביטוח: ${results.insurance.data.duplicateCount} כפילויות זוהו`);
  }
  if (results.pension?.data?.projection?.monthlyPensionEstimate) {
    parts.push(`פנסיה: ₪${results.pension.data.projection.monthlyPensionEstimate.toLocaleString('he-IL')} חזויים`);
  }
  return parts.join(' | ') || 'ניתוח הושלם.';
}

module.exports = { explainRecommendation, generateHebSummary };
