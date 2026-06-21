/**
 * Pension Agent
 *
 * Pipeline: buildPensionAnalysis → LLM explanation
 */

'use strict';

const { buildPensionAnalysis } = require('../../services/pensionAnalysisService');
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

  const analysis = await buildPensionAnalysis(userId);
  const { summary, projection, benchmark, healthCheck, recommendations } = analysis;

  if (!summary.hasData) {
    return {
      agentId: 'pension',
      status: 'no_data',
      message: 'לא נמצאו נתוני פנסיה. העלה תלוש שכר או דוח הר הכסף.',
      data: null,
      recommendations: [],
      llmExplanation: null,
      durationMs: Date.now() - startedAt,
    };
  }

  let llmExplanation = null;
  if (!skipLLM && process.env.ANTHROPIC_API_KEY) {
    try {
      const systemPrompt = buildPensionSystemPrompt({
        summary,
        projection,
        benchmark: benchmark?.summary,
        healthCheck: { score: healthCheck?.score, level: healthCheck?.level?.label },
        recommendationCount: recommendations.length,
      });
      const result = await askClaude(
        'ספק ניתוח קצר של מצב הפנסיה, דירוג מול השוק, ושורה תחתונה ב-3-4 משפטים בעברית.',
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
      benchmark: benchmark?.summary ?? null,
      healthCheck: healthCheck ? { score: healthCheck.score, level: healthCheck.level } : null,
      projection: projection ? {
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
