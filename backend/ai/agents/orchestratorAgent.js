/**
 * Orchestrator Agent
 *
 * Pipeline (CrewAI-equivalent, Node.js):
 *   0. Execution Canvas — onboarding + data inventory → domain tasks
 *   0.5 Gov prefetch — warm data.gov.il caches (pension-net + service index)
 *   1. Domain agents in parallel — payslip, insurance, pension, gemel, profile
 *   2. Merge recommendations + global health score + action items
 *   3. Orchestrator LLM summary (or rule fallback)
 *
 * IMPORTANT:
 *   - DB access only via executionCanvasService / financialHealthScoreService / agents
 *   - Never sends raw DB documents to LLM
 */



const { runPayslipAgent } = require('./payslipAgent');
const { runInsuranceAgent } = require('./insuranceAgent');
const { runPensionAgent } = require('./pensionAgent');
const { runGemelAgent } = require('./gemelAgent');
const { runFinancialProfileAgent } = require('./financialProfileAgent');
const { generateHebSummary } = require('./explanationAgent');
const { buildOrchestratorSystemPrompt } = require('../prompts/orchestratorPrompt');
const { askClaude } = require('../../services/claudeChatService');
const AgentRunLog = require('../../models/AgentRunLog');
const { buildExecutionCanvas } = require('../services/executionCanvasService');
const { prefetchGovMarketData } = require('../services/govDataPrefetchService');
const { buildActionItems } = require('../services/actionItemsBuilder');
const { buildFinancialHealthScore } = require('../../services/financialHealthScoreService');

/**
 * @param {string} userId
 * @param {object} [options]
 * @param {boolean} [options.skipLLM=false]
 * @param {string}  [options.focus] - 'payslip' | 'insurance' | 'pension' | 'gemel' | 'all'
 * @param {boolean} [options.refreshGovData=false]
 */
async function runFullAnalysis(userId, { skipLLM = false, focus = 'all', refreshGovData = false } = {}) {
  const startedAt = Date.now();
  const runId = `run_${userId}_${startedAt}`;
  const safeFocus = ['all', 'payslip', 'insurance', 'pension', 'gemel'].includes(focus) ? focus : 'all';

  // ── Step 0: Execution Canvas ───────────────────────────────────────────────
  const canvas = await buildExecutionCanvas(userId, { focus: safeFocus });

  // ── Step 0.5: Gov data prefetch + global score (parallel) ──────────────────
  const currentYear = new Date().getFullYear();
  const [govData, globalScore] = await Promise.all([
    prefetchGovMarketData({ forceRefresh: refreshGovData }),
    buildFinancialHealthScore(userId, currentYear).catch(err => ({
      score: null,
      level: null,
      label: null,
      error: err.message,
      topActions: [],
    })),
  ]);

  // ── Step 1: Run domain agents in parallel ────────────────────────────────────
  const agentOptions = { skipLLM };
  const shouldRun = domain => safeFocus === 'all' || safeFocus === domain;
  const agentPromises = {
    payslip: shouldRun('payslip') ? runPayslipAgent(userId, agentOptions) : Promise.resolve(null),
    insurance: shouldRun('insurance') ? runInsuranceAgent(userId, agentOptions) : Promise.resolve(null),
    pension: shouldRun('pension') ? runPensionAgent(userId, agentOptions) : Promise.resolve(null),
    gemel: shouldRun('gemel') ? runGemelAgent(userId, agentOptions) : Promise.resolve(null),
    profile: safeFocus === 'all' ? runFinancialProfileAgent(userId) : Promise.resolve(null),
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

  // ── Step 2: Merge recommendations + action items ─────────────────────────────
  const allRecommendations = mergeRecommendations(agentResults);
  const actionItems = buildActionItems({
    canvas,
    recommendations: allRecommendations,
    agentResults,
    globalScore,
  });

  // ── Step 3: Orchestrator LLM summary ───────────────────────────────────────
  const orchestratorContext = buildSafeContext({
    canvas,
    govData,
    globalScore,
    actionItems,
    agentResults,
  });

  let finalSummary = null;
  let finalSummarySource = 'fallback';

  if (!skipLLM && process.env.ANTHROPIC_API_KEY) {
    try {
      const systemPrompt = buildOrchestratorSystemPrompt(orchestratorContext);
      const result = await askClaude(
        'צור דוח FinGuide מאוחד: ציון בריאות, 3 פעולות דחופות, וסיכום לפי קנבס העבודה.',
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
    if (globalScore?.score != null) {
      finalSummary = `ציון בריאות פיננסי: ${globalScore.score}/100 (${globalScore.label || ''}). ${finalSummary}`;
    }
    finalSummarySource = 'rule';
  }

  const durationMs = Date.now() - startedAt;

  // ── Step 4: Log the run ──────────────────────────────────────────────────────
  try {
    await AgentRunLog.create({
      user: userId,
      runId,
      agentsRan: Object.keys(agentResults).filter(k => agentResults[k]),
      statuses: Object.fromEntries(
        Object.entries(agentResults)
          .filter(([, v]) => v)
          .map(([k, v]) => [k, v.status]),
      ),
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
    canvas,
    govData,
    globalScore: globalScore?.score != null
      ? {
        year: globalScore.year ?? currentYear,
        score: globalScore.score,
        level: globalScore.level,
        label: globalScore.label,
        categories: (globalScore.categories || []).map(c => ({
          id: c.id ?? c.key ?? null,
          label: c.label ?? c.name ?? null,
          score: c.score,
          maxScore: c.maxScore,
          status: c.status,
        })),
      }
      : null,
    actionItems,
    agents: agentResults,
    recommendations: allRecommendations,
    summary: finalSummary,
    summarySource: finalSummarySource,
    meta: {
      durationMs,
      agentCount: Object.values(agentResults).filter(Boolean).length,
      successCount: Object.values(agentResults).filter(a => a?.status === 'success').length,
      focus: safeFocus,
      canvasAgents: canvas.agentsToRun,
    },
  };
}

function mergeRecommendations(agentResults) {
  const all = [];
  for (const agent of Object.values(agentResults)) {
    if (!agent) continue;
    for (const rec of agent.recommendations || []) {
      all.push({ ...rec, agentId: agent.agentId });
    }
  }

  const urgencyOrder = { high: 0, medium: 1, low: 2 };
  const seen = new Set();
  return all
    .filter(r => {
      if (seen.has(r.type)) return false;
      seen.add(r.type);
      return true;
    })
    .sort((a, b) => (urgencyOrder[a.urgency] ?? 2) - (urgencyOrder[b.urgency] ?? 2));
}

function buildSafeContext({ canvas, govData, globalScore, actionItems, agentResults }) {
  const agents = Object.fromEntries(
    Object.entries(agentResults)
      .filter(([, agent]) => agent)
      .map(([key, agent]) => [
        key,
        {
          status: agent.status,
          data: agent.data,
          recommendationCount: agent.recommendations?.length || 0,
          topRecommendation: agent.recommendations?.[0] || null,
          verdict: agent.data?.fundAdvice?.overallVerdict
            || agent.data?.marketAdvice?.overallVerdict
            || null,
        },
      ]),
  );

  return {
    canvas: {
      focus: canvas.focus,
      summaryHe: canvas.summaryHe,
      onboarding: canvas.onboarding,
      dataInventory: canvas.dataInventory,
      domains: Object.fromEntries(
        Object.entries(canvas.domains || {}).map(([k, d]) => [
          k,
          { labelHe: d.labelHe, priority: d.priority, dataAvailable: d.dataAvailable, taskCount: d.tasks?.length },
        ]),
      ),
    },
    govData,
    globalScore: globalScore?.score != null
      ? { score: globalScore.score, label: globalScore.label, topActions: globalScore.topActions }
      : null,
    actionItems: actionItems.slice(0, 5),
    agents,
  };
}

module.exports = { runFullAnalysis, mergeRecommendations, buildActionItems };
