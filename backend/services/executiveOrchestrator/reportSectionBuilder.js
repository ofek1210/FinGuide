'use strict';

const { ROADMAP_BUCKETS, REVIEW_ITEMS } = require('../../config/executiveReportConfig');
const { priorityLabelHe } = require('./globalPriorityEngine');

function buildExecutiveSummary({ packages, priorityEngine, globalScore, conflicts }) {
  const sentences = [];
  const score = globalScore?.score;
  const label = globalScore?.label;

  if (score != null) {
    sentences.push(`ציון הבריאות הפיננסית שלך הוא ${score}/100${label ? ` (${label})` : ''}.`);
  } else {
    sentences.push('בנינו עבורך תמונה פיננסית מאוחדת מכל תחומי הכסף.');
  }

  const activeDomains = Object.entries(packages)
    .filter(([, p]) => p?.status === 'success')
    .map(([k]) => k);
  if (activeDomains.length >= 3) {
    sentences.push(`הניתוח מבוסס על ${activeDomains.length} תחומים: ${domainListHe(activeDomains)}.`);
  }

  if (priorityEngine.strengths.length) {
    sentences.push(`חוזקה בולטת: ${priorityEngine.strengths[0].title}.`);
  }

  if (priorityEngine.priorityActions.length) {
    const top = priorityEngine.priorityActions[0];
    sentences.push(`הפעולה החשובה ביותר כרגע: ${top.title}.`);
  } else {
    sentences.push('לא זוהו פעולות דחופות — המשך מעקב שוטף מספיק כרגע.');
  }

  if (priorityEngine.risks.length) {
    sentences.push(`נקודת תשומת לב: ${priorityEngine.risks[0].title}.`);
  }

  if (conflicts?.length) {
    sentences.push(`יש ${conflicts.length} נושא${conflicts.length > 1 ? 'ים' : ''} שדורש${conflicts.length > 1 ? 'ים' : ''} איזון — פירטנו בהמשך.`);
  }

  sentences.push('הדוח מרכז את כל ההמלצות לתוכנית פעולה אחת — מה דחוף, מה יכול לחכות, ומה כבר עובד טוב.');

  return sentences.slice(0, 8).join(' ');
}

function domainListHe(domains) {
  const map = {
    onboarding: 'פרופיל',
    payslip: 'תלוש',
    insurance: 'ביטוח',
    pension: 'פנסיה',
    gemel: 'גמל והשתלמות',
  };
  return domains.map(d => map[d] || d).join(', ');
}

function buildRoadmap(priorityActions) {
  const roadmap = {
    immediate: [],
    within30Days: [],
    within3Months: [],
    longTerm: [],
  };

  const placed = new Set();
  for (const action of priorityActions) {
    if (placed.has(action.id)) continue;
    placed.add(action.id);
    const bucket = action.urgency === 'immediate'
      ? 'immediate'
      : action.urgency === 'soon'
        ? 'within30Days'
        : action.urgency === 'planned'
          ? 'within3Months'
          : 'longTerm';
    roadmap[bucket].push({
      title: action.title,
      explanation: action.explanation,
      rank: action.rank,
    });
  }

  return roadmap;
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
  const executiveSummary = llmSummary || buildExecutiveSummary({
    packages,
    priorityEngine,
    globalScore,
    conflicts,
  });

  return {
    meta: {
      userId: String(userId),
      generatedAt: generatedAt || new Date().toISOString(),
      reportVersion: '1.0.0',
      agentCount: Object.values(packages).filter(p => p?.status === 'success').length,
      globalHealthScore: globalScore?.score ?? null,
      stats: priorityEngine.stats,
    },
    sections: {
      executiveSummary,
      topPriorityActions: priorityEngine.priorityActions.map(a => ({
        rank: a.rank,
        title: a.title,
        explanation: a.explanation,
        whyNow: a.whyNow,
        expectedBenefit: a.expectedBenefit,
        priorityScore: a.priorityScore,
        priorityLabel: a.priorityLabelHe,
        urgency: a.urgencyLabelHe,
        impactStars: a.impactStars,
        possibleSavings: a.possibleSavings,
        sourceAgents: a.sourceAgents,
        confidence: a.confidence ?? null,
        conflictNote: a.conflictNote,
      })),
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
      roadmap: buildRoadmap(priorityEngine.priorityActions),
      thingsToReviewRegularly: REVIEW_ITEMS,
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
  buildRoadmap,
};
