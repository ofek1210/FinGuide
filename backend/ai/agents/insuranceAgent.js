/**
 * Insurance Agent
 *
 * Pipeline: getInsuranceProfile → analyzeInsuranceCoverage → generateRecommendations → LLM
 */

'use strict';

const { getInsuranceProfile, analyzeInsuranceCoverage, generateInsuranceRecommendations } = require('../tools/insuranceTools');
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

  const insuranceProfile = await getInsuranceProfile(userId);

  if (!insuranceProfile.hasProfile) {
    return {
      agentId: 'insurance',
      status: 'no_profile',
      message: 'לא נמצא פרופיל ביטוחי. השלם את שלב הביטוח ב-onboarding.',
      data: null,
      recommendations: [],
      llmExplanation: null,
      durationMs: Date.now() - startedAt,
    };
  }

  const analysis = analyzeInsuranceCoverage(insuranceProfile);
  const recommendations = generateInsuranceRecommendations(analysis);

  let llmExplanation = null;
  if (!skipLLM && process.env.ANTHROPIC_API_KEY) {
    try {
      const systemPrompt = buildInsuranceSystemPrompt({
        profile: insuranceProfile.profile,
        personal: insuranceProfile.personal,
        assets: insuranceProfile.assets,
        duplicates: analysis.duplicates,
        missingCoverage: analysis.missingCoverage,
        savings: analysis.savings,
      });
      const result = await askClaude(
        'ספק סיכום קצר של מצב הביטוח וההמלצות ב-3-4 משפטים בעברית.',
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
      duplicateCount: analysis.duplicateCount,
      totalMonthlyWaste: analysis.totalMonthlyWaste,
      missingCoverage: analysis.missingCoverage,
      missingUrgency: analysis.missingUrgency,
      flags: analysis.flags,
      savings: analysis.savings,
      hasCriticalGap: analysis.hasCriticalGap,
    },
    recommendations,
    llmExplanation,
    durationMs: Date.now() - startedAt,
  };
}

module.exports = { runInsuranceAgent };
