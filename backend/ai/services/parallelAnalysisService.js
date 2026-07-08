/**
 * Parallel Analysis Service
 *
 * Entry point for the multi-agent system.
 * Validates input, calls orchestratorAgent, returns sanitized response.
 */



const { runFullAnalysis } = require('../agents/orchestratorAgent');

/**
 * @param {string} userId
 * @param {object} [options]
 * @param {string} [options.focus]
 * @param {boolean} [options.skipLLM]
 * @param {boolean} [options.refreshGovData]
 */
async function runParallelAnalysis(userId, { focus = 'all', skipLLM = false, refreshGovData = false } = {}) {
  if (!userId) throw new Error('userId is required');

  const validFocusValues = ['all', 'payslip', 'insurance', 'pension'];
  const safeFocus = validFocusValues.includes(focus) ? focus : 'all';

  const result = await runFullAnalysis(userId.toString(), {
    skipLLM,
    focus: safeFocus,
    refreshGovData: refreshGovData === true,
  });

  return {
    success: true,
    runId: result.runId,
    summary: result.summary,
    summarySource: result.summarySource,
    recommendations: result.recommendations,
    canvas: result.canvas,
    govData: result.govData,
    globalScore: result.globalScore,
    actionItems: result.actionItems,
    agents: Object.fromEntries(
      Object.entries(result.agents)
        .filter(([, agent]) => agent)
        .map(([key, agent]) => [
          key,
          {
            status: agent.status,
            message: agent.message || null,
            data: agent.data,
            recommendationCount: (agent.recommendations || []).length,
            durationMs: agent.durationMs,
            explanation: agent.llmExplanation || null,
          },
        ]),
    ),
    meta: result.meta,
  };
}

module.exports = { runParallelAnalysis };
