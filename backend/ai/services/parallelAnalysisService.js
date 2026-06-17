/**
 * Parallel Analysis Service
 *
 * Entry point for the multi-agent system.
 * Validates input, calls orchestratorAgent, returns sanitized response.
 */

'use strict';

const { runFullAnalysis } = require('../agents/orchestratorAgent');

/**
 * Run full AI analysis for a user.
 * Safe to call from any controller — enforces authorization.
 *
 * @param {string} userId - authenticated user ID (from req.user._id)
 * @param {object} [options]
 * @param {string} [options.focus] - 'all' | 'payslip' | 'insurance' | 'pension'
 * @param {boolean} [options.skipLLM] - rule-only mode (faster, no Claude costs)
 * @returns {Promise<FullAnalysisResponseDTO>}
 */
async function runParallelAnalysis(userId, { focus = 'all', skipLLM = false } = {}) {
  if (!userId) throw new Error('userId is required');

  const validFocusValues = ['all', 'payslip', 'insurance', 'pension'];
  const safeFocus = validFocusValues.includes(focus) ? focus : 'all';

  const result = await runFullAnalysis(userId.toString(), { skipLLM, focus: safeFocus });

  // Sanitize before returning to controller
  return {
    success: true,
    runId: result.runId,
    summary: result.summary,
    summarySource: result.summarySource,
    recommendations: result.recommendations,
    agents: Object.fromEntries(
      Object.entries(result.agents).map(([key, agent]) => [
        key,
        {
          status: agent.status,
          message: agent.message || null,
          data: agent.data,
          recommendationCount: (agent.recommendations || []).length,
          durationMs: agent.durationMs,
          // LLM explanation if available
          explanation: agent.llmExplanation || null,
        },
      ]),
    ),
    meta: result.meta,
  };
}

module.exports = { runParallelAnalysis };
