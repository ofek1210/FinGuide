/**
 * Orchestrator Agent
 *
 * Runs all domain agents in parallel, merges results, deduplicates
 * recommendations, and generates a final Hebrew summary via Claude.
 *
 * Architecture:
 *   User → Orchestrator → [PayslipAgent, InsuranceAgent, PensionAgent, ProfileAgent] (parallel)
 *                       → mergeResults → ExplanationAgent → final summary
 *
 * IMPORTANT:
 *   - Never accesses MongoDB directly — delegates to domain agents
 *   - Never sends raw DB documents to LLM
 */

'use strict';

const { runPayslipAgent } = require('./payslipAgent');
const { runInsuranceAgent } = require('./insuranceAgent');
const { runPensionAgent } = require('./pensionAgent');
const { runFinancialProfileAgent } = require('./financialProfileAgent');
const { generateHebSummary } = require('./explanationAgent');
const { buildOrchestratorSystemPrompt } = require('../prompts/orchestratorPrompt');
const { askClaude } = require('../../services/claudeChatService');
const AgentRunLog = require('../../models/AgentRunLog');

/**
 * Run the full multi-agent analysis for a user.
 *
 * @param {string} userId
 * @param {object} [options]
 * @param {boolean} [options.skipLLM=false] - disable Claude calls (rule-only mode)
 * @param {string}  [options.focus]         - 'payslip' | 'insurance' | 'pension' | 'all'
 * @returns {Promise<FullAnalysisResult>}
 */
async function runFullAnalysis(userId, { skipLLM = false, focus = 'all' } = {}) {
  const startedAt = Date.now();
  const runId = `run_${userId}_${startedAt}`;

  // ── Step 1: Run agents in parallel ─────────────────────────────────────────
  const agentOptions = { skipLLM };
  const agentPromises = {
    payslip: focus === 'insurance' || focus === 'pension' ? Promise.resolve(null) : runPayslipAgent(userId, agentOptions),
    insurance: focus === 'payslip' || focus === 'pension' ? Promise.resolve(null) : runInsuranceAgent(userId, agentOptions),
    pension: focus === 'payslip' || focus === 'insurance' ? Promise.resolve(null) : runPensionAgent(userId, agentOptions),
    profile: runFinancialProfileAgent(userId),
  };

  const settled = await Promise.allSettled(Object.values(agentPromises));
  const keys = Object.keys(agentPromises);

  const agentResults = {};
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const result = settled[i];
    if (result.status === 'fulfilled') {
      agentResults[key] = result.value;
    } else {
      agentResults[key] = {
        agentId: key,
        status: 'error',
        error: result.reason?.message || 'Unknown error',
        data: null,
        recommendations: [],
      };
    }
  }

  // ── Step 2: Merge recommendations ──────────────────────────────────────────
  const allRecommendations = mergeRecommendations(agentResults);

  // ── Step 3: Orchestrator LLM summary ───────────────────────────────────────
  let finalSummary = null;
  let finalSummarySource = 'fallback';

  if (!skipLLM && process.env.ANTHROPIC_API_KEY) {
    try {
      const systemPrompt = buildOrchestratorSystemPrompt(buildSafeContext(agentResults));
      const result = await askClaude(
        'צור סיכום פיננסי מקיף ופעולות מומלצות בהתבסס על ניתוח הסוכנים.',
        systemPrompt,
        [],
      );
      finalSummary = result?.answer || null;
      finalSummarySource = 'claude';
    } catch {
      // Fall through to rule-based fallback
    }
  }

  if (!finalSummary) {
    finalSummary = await generateHebSummary(agentResults);
    finalSummarySource = 'rule';
  }

  const durationMs = Date.now() - startedAt;

  // ── Step 4: Log the run ────────────────────────────────────────────────────
  try {
    await AgentRunLog.create({
      user: userId,
      runId,
      agentsRan: Object.keys(agentResults),
      statuses: Object.fromEntries(Object.entries(agentResults).map(([k, v]) => [k, v.status])),
      totalRecommendations: allRecommendations.length,
      durationMs,
      summarySource: finalSummarySource,
    });
  } catch {
    // Logging is non-fatal
  }

  return {
    runId,
    userId,
    agents: agentResults,
    recommendations: allRecommendations,
    summary: finalSummary,
    summarySource: finalSummarySource,
    meta: {
      durationMs,
      agentCount: Object.keys(agentResults).length,
      successCount: Object.values(agentResults).filter((a) => a?.status === 'success').length,
    },
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function mergeRecommendations(agentResults) {
  const all = [];
  for (const agent of Object.values(agentResults)) {
    for (const rec of agent?.recommendations || []) {
      all.push({ ...rec, agentId: agent.agentId });
    }
  }

  // Deduplicate by type, sort by urgency
  const urgencyOrder = { high: 0, medium: 1, low: 2 };
  const seen = new Set();
  return all
    .filter((r) => {
      if (seen.has(r.type)) return false;
      seen.add(r.type);
      return true;
    })
    .sort((a, b) => (urgencyOrder[a.urgency] ?? 2) - (urgencyOrder[b.urgency] ?? 2));
}

function buildSafeContext(agentResults) {
  // Strip large raw data — send only summaries to LLM
  return Object.fromEntries(
    Object.entries(agentResults).map(([key, agent]) => [
      key,
      {
        status: agent?.status,
        data: agent?.data,
        recommendationCount: agent?.recommendations?.length || 0,
        topRecommendation: agent?.recommendations?.[0] || null,
      },
    ]),
  );
}

module.exports = { runFullAnalysis };
