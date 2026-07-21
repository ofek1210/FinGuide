'use strict';

const { REVIEW_ITEMS } = require('../../config/executiveReportConfig');
const { runReportCoordinator } = require('./reportCoordinator');

function buildExecutiveSummary({ coordinator, packages }) {
  return coordinator.userSummary;
}

function buildExecutiveReport({
  userId,
  generatedAt,
  packages,
  priorityEngine,
  globalScore,
  conflicts,
  llmSummary = null,
}) {
  const coordinator = runReportCoordinator({
    packages,
    scoredItems: priorityEngine.scoredItems,
    conflicts: conflicts || priorityEngine.conflicts,
    globalScore,
  });

  const executiveSummary = llmSummary || buildExecutiveSummary({ coordinator, packages });

  const userFriendly = {
    title: 'הדוח הפיננסי האישי שלי',
    myPicture: coordinator.personalOverview,
    whatWeFound: {
      mainDecisions: coordinator.mainDecisions,
      additionalFindings: coordinator.allRecommendations.filter(r =>
        r.classification === 'additionalFinding' || r.classification === 'monitoringItem',
      ),
      strengths: priorityEngine.strengths.map(s => ({ title: s.title, explanation: s.explanation })),
      risks: priorityEngine.risks.map(r => ({ title: r.title, explanation: r.explanation, severity: r.severity })),
    },
    improvementPotential: {
      managementFees: coordinator.managementFees,
      monetaryHighlights: coordinator.mainDecisions
        .filter(d => d.monetaryImpact?.hasImpact)
        .map(d => ({ title: d.title, impact: d.monetaryImpact })),
    },
    whatToDo: coordinator.actionPlan.doNow,
    beforeChange: coordinator.actionPlan.beforeChange,
    missingData: coordinator.actionPlan.missingData,
  };

  const professional = {
    title: 'סיכום פיננסי לאיש מקצוע',
    reportDate: generatedAt || new Date().toISOString(),
    dataSources: coordinator.personalOverview.availableReports,
    productInventory: coordinator.managementFees.products,
    balances: coordinator.currentPosition.items,
    deposits: coordinator.currentPosition.items.filter(i => /הפקדה/i.test(i.label)),
    fees: coordinator.managementFees,
    investmentTracks: coordinator.productAlternatives,
    insuranceCoverage: coordinator.insuranceSummary,
    projections: coordinator.currentPosition.items.filter(i => /צפו/i.test(i.label)),
    findingsByAgent: Object.fromEntries(
      Object.entries(packages)
        .filter(([k]) => k !== 'onboarding')
        .map(([k, p]) => [k, {
          status: p.status,
          findings: (p.findings || []).map(f => ({ title: f.title, explanation: f.explanation })),
          recommendations: (p.recommendations || []).map(r => ({ id: r.id, title: r.title })),
        }]),
    ),
    consolidatedRecommendations: coordinator.allRecommendations,
    assumptions: coordinator.mainDecisions
      .flatMap(d => d.monetaryImpact?.assumptions || [])
      .filter(Boolean),
    missingData: coordinator.actionPlan.missingData,
    sourceAttribution: coordinator.allRecommendations.map(r => ({
      title: r.title,
      sourceAgents: r.sourceAgents,
      sourceReports: r.sourceReports,
      originalRecommendationIds: r.originalRecommendationIds,
      confidence: r.confidence,
    })),
    disclaimer: 'הדוח נועד להנגיש מידע — אינו ייעוץ השקעות, ייעוץ פנסיוני או המלצה לביצוע עסקה.',
  };

  return {
    meta: {
      userId: String(userId),
      generatedAt: generatedAt || new Date().toISOString(),
      reportVersion: '2.0.0',
      agentCount: Object.values(packages).filter(p => p?.status === 'success').length,
      globalHealthScore: globalScore?.score ?? null,
      stats: { ...priorityEngine.stats, ...coordinator.stats },
    },
    sections: {
      executiveSummary,
      personalOverview: coordinator.personalOverview,
      currentPosition: coordinator.currentPosition,
      mainDecisions: coordinator.mainDecisions,
      managementFees: coordinator.managementFees,
      insuranceSummary: coordinator.insuranceSummary,
      payslipFindings: coordinator.payslipFindings,
      productAlternatives: coordinator.productAlternatives,
      actionPlan: coordinator.actionPlan,
      allRecommendations: coordinator.allRecommendations,
      financialStrengths: priorityEngine.strengths.map(s => ({
        title: s.title,
        explanation: s.explanation,
      })),
      risks: priorityEngine.risks.map(r => ({
        title: r.title,
        explanation: r.explanation,
        severity: r.severity,
      })),
      opportunities: priorityEngine.opportunities.map(o => ({
        title: o.title,
        explanation: o.explanation,
        possibleSavings: o.possibleSavings ?? null,
      })),
      conflicts: (conflicts || []).map(c => ({
        title: c.title,
        explanation: c.explanation,
        tradeOff: c.tradeOff,
        recommendation: c.recommendation,
      })),
      thingsToReviewRegularly: REVIEW_ITEMS,
      userFriendly,
      professional,
    },
    agentOutputs: Object.fromEntries(
      Object.entries(packages).map(([k, p]) => [k, {
        agentId: p.agentId,
        status: p.status,
        humanExplanation: p.humanExplanation,
        structured: p.structured,
      }]),
    ),
    disclaimer: 'הדוח נועד להנגיש מידע ותובנות — אינו מהווה ייעוץ השקעות, ייעוץ פנסיוני או המלצה לביצוע עסקה. יש להתייעץ עם בעל רישיון לפני קבלת החלטות.',
  };
}

module.exports = {
  buildExecutiveReport,
  buildExecutiveSummary,
};
