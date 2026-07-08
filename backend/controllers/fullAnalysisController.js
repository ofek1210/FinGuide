/**
 * Full Analysis Controller
 *
 * POST /api/ai/full-analysis
 *
 * Delegates to parallelAnalysisService — never accesses DB directly.
 *
 * Request body (all optional):
 *   { focus, skipLLM, refreshGovData }
 *
 * Response:
 *   { success, runId, summary, canvas, govData, globalScore, actionItems, agents, meta }
 */



const { runParallelAnalysis } = require('../ai/services/parallelAnalysisService');
const { MOCK_FULL_ANALYSIS_RESULT } = require('../ai/mock/mockData');
const { isDemoRequest } = require('../utils/demoMode');

async function runFullAnalysisHandler(req, res) {
  const userId = req.user._id;
  const { focus = 'all', skipLLM = false, refreshGovData = false } = req.body || {};

  if (isDemoRequest(req)) {
    return res.json({ success: true, ...MOCK_FULL_ANALYSIS_RESULT });
  }

  const result = await runParallelAnalysis(userId, {
    focus: typeof focus === 'string' ? focus : 'all',
    skipLLM: skipLLM === true,
    refreshGovData: refreshGovData === true,
  });

  return res.json(result);
}

module.exports = { runFullAnalysisHandler };
