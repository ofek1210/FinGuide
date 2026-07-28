'use strict';

const { SPECIALIST_AGENTS } = require('../../config/executiveReportConfig');
const { buildAgentFirstReport } = require('./agentReportSections');

function buildExecutiveSummary(agentReport) {
  const parts = [agentReport.intro];
  const actionable = (agentReport.actionPlan || []).filter(a => a.priority === 'high' || a.priority === 'medium');
  if (actionable.length) {
    parts.push(`תוכנית הפעולה כוללת ${actionable.length} צעדים בעדיפות גבוהה או בינונית.`);
  } else {
    const withRecs = agentReport.agentSections.filter(s => s.recommendationStatus === 'hasRecommendations');
    if (withRecs.length) {
      parts.push(`נמצאו המלצות ב${withRecs.map(s => s.title).join(', ')}.`);
    }
  }
  if (agentReport.missingData.length) {
    parts.push(`${agentReport.missingData.length} תחומים דורשים השלמת מסמכים.`);
  }
  return parts.join(' ');
}

function buildExecutiveReport({
  userId,
  generatedAt,
  packages,
  priorityEngine,
  globalScore: _globalScore,
  conflicts,
  llmSummary = null,
}) {
  const agentReport = buildAgentFirstReport(packages, { scoredItems: priorityEngine?.scoredItems });
  const executiveSummary = llmSummary || buildExecutiveSummary(agentReport);

  // Slim preserved list for API/debug — prefer bestDecision mirrors over full agent dumps.
  const preservedRecommendations = agentReport.agentSections
    .flatMap(s => s.recommendations || [])
    .filter(Boolean);

  return {
    meta: {
      userId: String(userId),
      generatedAt: generatedAt || new Date().toISOString(),
      reportVersion: '2.2.0',
      agentCount: agentReport.agentSections.filter(s => s.dataStatus === 'available').length,
      stats: {
        ...priorityEngine.stats,
        agentsReported: SPECIALIST_AGENTS.length,
        preservedRecommendationCount: preservedRecommendations.length,
        actionPlanCount: agentReport.actionPlan?.length ?? 0,
      },
    },
    sections: {
      title: agentReport.title,
      executiveSummary,
      agentReport,
      preservedRecommendations,
      conflicts: (conflicts || []).map(c => ({
        title: c.title,
        explanation: c.explanation,
        tradeOff: c.tradeOff,
        recommendation: c.recommendation,
      })),
    },
    agentOutputs: Object.fromEntries(
      Object.entries(packages)
        .filter(([k]) => k !== 'onboarding')
        .map(([k, p]) => [k, {
          agentId: p.agentId,
          status: p.status,
          humanExplanation: p.humanExplanation,
          recommendationCount: (p.recommendations || []).filter(r => r.itemKind !== 'missing_data').length,
        }]),
    ),
    disclaimer: 'הדוח נועד להנגיש מידע ותובנות — אינו מהווה ייעוץ השקעות, ייעוץ פנסיוני או המלצה לביצוע עסקה. יש להתייעץ עם בעל רישיון לפני קבלת החלטות.',
  };
}

module.exports = {
  buildExecutiveReport,
  buildExecutiveSummary,
};
