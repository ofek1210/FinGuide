/**
 * Pension Agent
 *
 * Pipeline: getPensionSummary → projectRetirementIncome → generateRecommendations → LLM
 */

'use strict';

const { getPensionSummary, projectRetirementIncome, generatePensionRecommendations } = require('../tools/pensionTools');
const { buildPensionSystemPrompt } = require('../prompts/pensionPrompt');
const { askClaude } = require('../../services/claudeChatService');

/**
 * @param {string} userId
 * @param {object} [options]
 * @param {boolean} [options.skipLLM=false]
 * @returns {Promise<PensionAgentResult>}
 */
async function runPensionAgent(userId, { skipLLM = false } = {}) {
  const startedAt = Date.now();

  const summary = await getPensionSummary(userId);

  if (!summary.hasData) {
    return {
      agentId: 'pension',
      status: 'no_data',
      message: 'לא נמצאו נתוני פנסיה. העלה תלוש שכר עם נתוני הפרשות.',
      data: null,
      recommendations: [],
      llmExplanation: null,
      durationMs: Date.now() - startedAt,
    };
  }

  const projection = projectRetirementIncome(summary);
  const recommendations = generatePensionRecommendations(summary, projection);

  let llmExplanation = null;
  if (!skipLLM && process.env.ANTHROPIC_API_KEY) {
    try {
      const systemPrompt = buildPensionSystemPrompt({
        summary,
        projection,
        recommendationCount: recommendations.length,
      });
      const result = await askClaude(
        'ספק ניתוח קצר של מצב הפנסיה והתחזית לפרישה ב-3-4 משפטים בעברית.',
        systemPrompt,
        [],
      );
      llmExplanation = result?.answer || null;
    } catch {
      // Non-fatal
    }
  }

  return {
    agentId: 'pension',
    status: 'success',
    data: {
      grossSalary: summary.grossSalary,
      pensionEmployee: summary.pensionEmployee,
      pensionEmployer: summary.pensionEmployer,
      totalMonthlyContribution: summary.totalMonthlyContribution,
      projection: projection.available ? {
        monthsToRetirement: projection.monthsToRetirement,
        projectedAccumulation: projection.projectedAccumulation,
        monthlyPensionEstimate: projection.monthlyPensionEstimate,
        replacementRatio: projection.replacementRatio,
        scenarios: projection.scenarios,
        mgmtFeeSavings: projection.mgmtFeeSavings,
      } : null,
    },
    recommendations,
    llmExplanation,
    durationMs: Date.now() - startedAt,
  };
}

module.exports = { runPensionAgent };
