'use strict';

const { runParallelAnalysis } = require('../ai/services/parallelAnalysisService');
const { MOCK_FULL_ANALYSIS_RESULT } = require('../ai/mock/mockData');

/**
 * POST /api/ai/full-analysis
 * Body: { focus?, skipLLM?, demo? }
 * Query: ?demo=true  — returns mock data without DB/LLM access
 */
async function runFullAnalysisHandler(req, res) {
  const userId = req.user._id;
  const { focus = 'all', skipLLM = false, demo = false } = req.body || {};

  if (demo === true || req.query.demo === 'true') {
    return res.json({ success: true, ...MOCK_FULL_ANALYSIS_RESULT });
  }

  const result = await runParallelAnalysis(userId, {
    focus: typeof focus === 'string' ? focus : 'all',
    skipLLM: skipLLM === true,
  });

  return res.json(result);
}

module.exports = { runFullAnalysisHandler };
