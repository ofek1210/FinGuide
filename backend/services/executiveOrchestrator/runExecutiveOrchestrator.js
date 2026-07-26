'use strict';

/**
 * Financial Executive Orchestrator — final intelligence layer.
 * Collects structured outputs from all specialist agents, prioritizes globally,
 * and produces one unified executive report (+ PDF).
 */

const { runPayslipAgent } = require('../../ai/agents/payslipAgent');
const { runInsuranceAgent } = require('../../ai/agents/insuranceAgent');
const { runPensionAgent } = require('../../ai/agents/pensionAgent');
const { runGemelAgent } = require('../../ai/agents/gemelAgent');
const { runFinancialProfileAgent } = require('../../ai/agents/financialProfileAgent');
const { buildExecutionCanvas } = require('../../ai/services/executionCanvasService');
const { buildFinancialHealthScore } = require('../financialHealthScoreService');
const { normalizeAllAgentOutputs } = require('./agentOutputNormalizer');
const { runGlobalPriorityEngine } = require('./globalPriorityEngine');
const { buildExecutiveReport } = require('./reportSectionBuilder');
const { polishExecutiveSummary } = require('./executiveLlmService');
const { generateExecutiveReportPdf } = require('./executivePdfService');
const { saveExecutiveReport } = require('./executiveReportCache');
const AgentRunLog = require('../../models/AgentRunLog');

async function collectAgentResults(userId, { skipLLM = false } = {}) {
  const [canvas, globalScore, settled] = await Promise.all([
    buildExecutionCanvas(userId, { focus: 'all' }),
    buildFinancialHealthScore(userId, new Date().getFullYear()).catch(() => null),
    Promise.allSettled([
      runPayslipAgent(userId, { skipLLM }),
      runInsuranceAgent(userId, { skipLLM }),
      runPensionAgent(userId, { skipLLM }),
      runGemelAgent(userId, { skipLLM }),
      runFinancialProfileAgent(userId),
    ]),
  ]);

  const keys = ['payslip', 'insurance', 'pension', 'gemel', 'profile'];
  const agentResults = {};
  settled.forEach((result, i) => {
    const key = keys[i];
    agentResults[key] = result.status === 'fulfilled'
      ? result.value
      : { agentId: key, status: 'error', error: result.reason?.message, recommendations: [] };
  });

  return { canvas, globalScore, agentResults, profileAgent: agentResults.profile };
}

/**
 * @param {string} userId
 * @param {object} [options]
 * @param {boolean} [options.skipLLM=false]
 * @param {boolean} [options.includePdf=false]
 */
async function runExecutiveOrchestrator(userId, { skipLLM = false, includePdf = false } = {}) {
  const startedAt = Date.now();
  const runId = `exec_${userId}_${startedAt}`;

  const { canvas, globalScore, agentResults, profileAgent } = await collectAgentResults(userId, { skipLLM });

  const normalizedPackages = normalizeAllAgentOutputs({
    agentResults,
    canvas,
    profileAgent,
  });

  const priorityEngine = runGlobalPriorityEngine(normalizedPackages);

  let report = buildExecutiveReport({
    userId,
    generatedAt: new Date().toISOString(),
    packages: normalizedPackages,
    priorityEngine,
    globalScore,
    conflicts: priorityEngine.conflicts,
  });

  const polished = await polishExecutiveSummary(report, { skipLLM });
  report.sections.executiveSummary = polished.summary;
  report.llm = polished.llm;

  let pdfBuffer = null;
  if (includePdf) {
    pdfBuffer = await generateExecutiveReportPdf(report);
  }

  const durationMs = Date.now() - startedAt;

  try {
    await saveExecutiveReport(userId, runId, report);
  } catch (err) {
    console.warn('[executiveOrchestrator] failed to cache report:', err.message);
  }

  try {
    await AgentRunLog.create({
      user: userId,
      runId,
      agentsRan: Object.keys(normalizedPackages),
      statuses: Object.fromEntries(
        Object.entries(normalizedPackages).map(([k, p]) => [k, p.status]),
      ),
      totalRecommendations: priorityEngine.stats.preservedCount,
      durationMs,
      summarySource: polished.llm?.used ? 'claude' : 'rule',
    });
  } catch {
    // non-fatal
  }

  return {
    success: true,
    runId,
    report,
    pdf: pdfBuffer ? pdfBuffer.toString('base64') : null,
    meta: {
      durationMs,
      agentStatuses: Object.fromEntries(
        Object.entries(normalizedPackages).map(([k, p]) => [k, p.status]),
      ),
      ...report.meta,
      llm: report.llm,
    },
  };
}

module.exports = {
  runExecutiveOrchestrator,
  collectAgentResults,
};
