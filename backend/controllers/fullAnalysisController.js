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

'use strict';

const { runParallelAnalysis } = require('../ai/services/parallelAnalysisService');
const { MOCK_FULL_ANALYSIS_RESULT } = require('../ai/mock/mockData');

async function runFullAnalysisHandler(req, res) {
  const userId = req.user._id;
  const { focus = 'all', skipLLM = false, refreshGovData = false, demo = false } = req.body || {};

  if (demo === true || req.query.demo === 'true') {
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
