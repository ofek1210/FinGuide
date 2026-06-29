/**
 * Insurance Agent
 *
 * Pipeline: buildInsuranceAnalysis → LLM explanation
 */

'use strict';

const { buildInsuranceAnalysis } = require('../../services/insuranceAnalysisService');
const { buildInsuranceSystemPrompt } = require('../prompts/insurancePrompt');
const { askClaude } = require('../../services/claudeChatService');

/**
 * @param {string} userId
 * @param {object} [options]
 * @param {boolean} [options.skipLLM=false]
 * @returns {Promise<InsuranceAgentResult>}
 */
async function runInsuranceAgent(userId, { skipLLM = false } = {}) {
  const startedAt = Date.now();

  const analysis = await buildInsuranceAnalysis(userId);
  const { profile, personal, assets, policies, analysis: coverage, healthCheck, recommendations, marketAdvice } = analysis;

  const hasData = analysis.hasImportedPolicies || analysis.summary?.hasData;
  if (!hasData && !profile) {
    return {
      agentId: 'insurance',
      status: 'no_data',
      message: 'לא נמצאו נתוני ביטוח. ייבא דוח מהר הביטוח או השלם את פרופיל הביטוח.',
      data: null,
      recommendations: [],
      llmExplanation: null,
      durationMs: Date.now() - startedAt,
    };
  }

  let llmExplanation = null;
  if (!skipLLM && process.env.ANTHROPIC_API_KEY) {
    try {
      const systemPrompt = buildInsuranceSystemPrompt({
        profile,
        personal,
        assets,
        policies,
        aggregationSummary: coverage?.aggregationSummary,
        aggregatedPolicies: coverage?.aggregatedPolicies,
        duplicates: coverage?.duplicates,
        missingCoverage: coverage?.missingCoverage,
        savings: coverage?.savings,
        healthCheck: healthCheck ? { score: healthCheck.score, level: healthCheck.level?.label } : null,
        marketAdvice,
      });
      const result = await askClaude(
        'ספק ניתוח ביטוח: מטריצת עלות/שירות/מדד תביעות, כפילויות, ופסק דין STAY/REVIEW/SWITCH — 4-5 משפטים בעברית.',
        systemPrompt,
        [],
      );
      llmExplanation = result?.answer || null;
    } catch {
      // Non-fatal
    }
  }

  return {
    agentId: 'insurance',
    status: 'success',
    data: {
      policyCount: policies?.length ?? 0,
      aggregation: coverage?.aggregationSummary ?? null,
      duplicateCount: coverage?.duplicateCount ?? 0,
      totalMonthlyWaste: coverage?.totalMonthlyWaste ?? 0,
      missingCoverage: coverage?.missingCoverage ?? [],
      missingUrgency: coverage?.missingUrgency,
      flags: coverage?.flags ?? [],
      savings: coverage?.savings,
      hasCriticalGap: coverage?.hasCriticalGap ?? false,
      healthCheck: healthCheck ? { score: healthCheck.score, level: healthCheck.level } : null,
      marketAdvice: marketAdvice?.hasData
        ? {
          overallVerdict: marketAdvice.overallVerdict,
          overallVerdictLabelHe: marketAdvice.overallVerdictLabelHe,
          comparisonMatrix: marketAdvice.comparisonMatrix,
          duplicateCount: marketAdvice.duplicateCount,
          dataSource: marketAdvice.dataSource,
        }
        : null,
    },
    recommendations,
    llmExplanation,
    durationMs: Date.now() - startedAt,
  };
}

module.exports = { runInsuranceAgent };
