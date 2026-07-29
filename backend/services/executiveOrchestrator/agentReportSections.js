'use strict';

const { AGENT_SOURCE_REPORT, SPECIALIST_AGENTS } = require('../../config/executiveReportConfig');
const { buildManagementFeeSection } = require('./reportCoordinator');
const {
  synthesizeAdvisorReport,
  decisionToRecommendation,
} = require('./advisorDecisionSynthesizer');

const AGENT_LABELS = {
  pension: 'פנסיה',
  gemel: 'גמל וקרנות השתלמות',
  insurance: 'ביטוח',
  payslip: 'תלושי שכר',
};

const NO_RECS_HE = 'הנתונים התקבלו ונבדקו. לא נמצאו כרגע המלצות מהותיות לשינוי.';
const MISSING_HE = 'לא ניתן לבצע ניתוח משום שהמסמך או הנתונים הנדרשים לא התקבלו.';
const ERROR_HE = 'לא ניתן לטעון את ניתוח הסוכן. ניתן לרענן את הדוח או לנסות שוב מאוחר יותר.';

const MISSING_HINTS = {
  pension: {
    missing: 'דוח מסלקה פנסיונית (Excel)',
    enables: 'ניתוח קרנות פנסיה, דמי ניהול, מסלולי השקעה וכיסויים ביטוחיים במסגרת הפנסיה.',
  },
  gemel: {
    missing: 'דוח מסלקה פנסיונית הכולל קופות גמל / קרנות השתלמות',
    enables: 'ניתוח יתרות, דמי ניהול, השוואת מוצרים והמלצות לגמל והשתלמות.',
  },
  insurance: {
    missing: 'דוח הר הביטוח (Excel)',
    enables: 'ניתוח כיסויים, כפילויות ביטוח ופערי הגנה.',
  },
  payslip: {
    missing: 'תלושי שכר (PDF)',
    enables: 'בדיקת הפקדות, ניכויים, מס והתאמה מול הפנסיה.',
  },
};

function resolveDataStatus(pkg) {
  if (!pkg) return 'missing';
  if (pkg.status === 'error') return 'error';
  if (pkg.status === 'no_data') return 'missing';
  if (pkg.status === 'success') return 'available';
  return 'missing';
}

function resolveRecommendationStatus(pkg, bestDecision = null) {
  const dataStatus = resolveDataStatus(pkg);
  if (dataStatus !== 'available') return 'unavailable';
  if (bestDecision) {
    if (bestDecision.verdict === 'no_action') return 'noRecommendations';
    return 'hasRecommendations';
  }
  const financial = (pkg.recommendations || []).filter(r => r.itemKind !== 'missing_data');
  return financial.length > 0 ? 'hasRecommendations' : 'noRecommendations';
}

function sourceLabel(agentId, pkg) {
  const data = pkg?.rawDataSummary;
  if (agentId === 'pension') return data?.fundAdvice?.dataSource || AGENT_SOURCE_REPORT.pension;
  if (agentId === 'gemel') {
    return data?.marketAdvice?.sourceName || data?.marketAdvice?.dataSource || AGENT_SOURCE_REPORT.gemel;
  }
  if (agentId === 'insurance') return AGENT_SOURCE_REPORT.insurance;
  if (agentId === 'payslip') return AGENT_SOURCE_REPORT.payslip;
  return AGENT_SOURCE_REPORT[agentId] || agentId;
}

function preserveRecommendation(rec, agentId) {
  return {
    agentId,
    recommendationId: rec.id || null,
    title: rec.title || '',
    description: rec.explanation || rec.title || '',
    reason: rec.whyItMatters || null,
    expectedBenefit: rec.expectedBenefit || null,
    source: rec.sourceReport || sourceLabel(agentId, null),
    confidence: rec.confidence ?? null,
  };
}

function buildDataSummary(agentId, pkg) {
  const data = pkg?.rawDataSummary;
  const items = [];
  if (!data) return items;

  if (agentId === 'pension') {
    if (data.projection?.projectedAccumulation != null) {
      items.push({ label: 'צבירה צפויה לפרישה', value: `₪${Math.round(data.projection.projectedAccumulation).toLocaleString('he-IL')}` });
    }
    if (data.totalMonthlyContribution != null) {
      items.push({ label: 'הפקדה חודשית', value: `₪${Math.round(data.totalMonthlyContribution).toLocaleString('he-IL')}` });
    }
    if (data.fundAdvice?.funds?.length) {
      items.push({ label: 'מוצרי פנסיה', value: String(data.fundAdvice.funds.length) });
    }
  }

  if (agentId === 'gemel') {
    if (data.totalBalance != null) {
      items.push({ label: 'יתרה בגמל והשתלמות', value: `₪${Math.round(data.totalBalance).toLocaleString('he-IL')}` });
    }
    if (data.fundCount != null) {
      items.push({ label: 'מספר מוצרים', value: String(data.fundCount) });
    }
    if (data.totalMonthlyContribution != null) {
      items.push({ label: 'הפקדה חודשית', value: `₪${Math.round(data.totalMonthlyContribution).toLocaleString('he-IL')}` });
    }
  }

  if (agentId === 'insurance') {
    if (data.policyCount != null) {
      items.push({ label: 'פוליסות', value: String(data.policyCount) });
    }
    if (data.duplicateCount > 0) {
      items.push({ label: 'כפילויות לבדיקה', value: String(data.duplicateCount) });
    }
    if (data.totalMonthlyWaste > 0) {
      items.push({ label: 'פרמיה חודשית לבדיקה', value: `₪${Math.round(data.totalMonthlyWaste).toLocaleString('he-IL')}` });
    }
  }

  if (agentId === 'payslip') {
    if (data.payslipCount != null) {
      items.push({ label: 'תלושים במערכת', value: String(data.payslipCount) });
    }
  }

  return items.slice(0, 4);
}

function specialistFindings(pkg, bestDecision) {
  // Insurance bullets already cover findings; keep other domains very short.
  if (bestDecision?.bullets?.length) return [];
  return (pkg.findings || [])
    .filter(f => f.kind !== 'strength')
    .slice(0, 2)
    .map(f => ({
      title: f.title,
      explanation: f.explanation || '',
      severity: f.severity || null,
    }));
}

function buildAgentSection(agentId, pkg, bestDecision = null) {
  const dataStatus = resolveDataStatus(pkg);
  const recommendationStatus = resolveRecommendationStatus(pkg, bestDecision);

  let statusMessage = null;
  if (dataStatus === 'missing') statusMessage = MISSING_HE;
  else if (dataStatus === 'error') statusMessage = ERROR_HE;
  else if (recommendationStatus === 'noRecommendations' && !bestDecision) statusMessage = NO_RECS_HE;
  else if (bestDecision?.verdict === 'no_action') statusMessage = NO_RECS_HE;

  const hint = MISSING_HINTS[agentId];
  const missingDetail = dataStatus === 'missing' && hint
    ? { whatIsMissing: hint.missing, whatEnables: hint.enables }
    : null;

  // Single mirrored recommendation when we have a decision — no long lists.
  let recommendations = [];
  if (dataStatus === 'available' && bestDecision) {
    const mirrored = decisionToRecommendation(bestDecision);
    if (mirrored) recommendations = [mirrored];
  } else if (dataStatus === 'available') {
    recommendations = (pkg?.recommendations || [])
      .filter(r => r.itemKind !== 'missing_data')
      .slice(0, 1)
      .map(r => preserveRecommendation(r, agentId));
  }

  return {
    agentId,
    title: AGENT_LABELS[agentId] || agentId,
    dataStatus,
    recommendationStatus,
    statusMessage,
    missingDetail,
    dataSummary: buildDataSummary(agentId, pkg),
    findings: dataStatus === 'available' ? specialistFindings(pkg, bestDecision) : [],
    recommendations,
    bestDecision: dataStatus === 'available' ? bestDecision : null,
    plainLanguageExplanation: null,
    nextActions: [],
    sourceData: dataStatus === 'available' ? sourceLabel(agentId, pkg) : null,
  };
}

function buildCombinedSummary(agentSections, packages, decisionByAgent = {}) {
  const notes = [];
  const fees = buildManagementFeeSection(packages);

  // Drop fee rows already covered by a pension/gemel decision with savings.
  const coveredAgents = new Set(
    Object.values(decisionByAgent)
      .filter(d => d?.actionable && d.annualSavings != null)
      .map(d => d.agentId),
  );
  const slimProducts = (fees.products || []).filter(p => !coveredAgents.has(p.sourceAgent));
  const slimFees = {
    ...fees,
    products: slimProducts,
    totalEstimatedAnnualExcess: slimProducts.length
      ? slimProducts.reduce((s, p) => s + (p.estimatedAnnualExcess || 0), 0) || null
      : null,
  };

  if (slimFees.totalEstimatedAnnualExcess != null && slimFees.totalEstimatedAnnualExcess > 0) {
    notes.push(`סה"כ עודף שנתי מוערך בדמי ניהול: ₪${Math.round(slimFees.totalEstimatedAnnualExcess).toLocaleString('he-IL')}.`);
  }

  const payslip = agentSections.find(s => s.agentId === 'payslip');
  const pension = agentSections.find(s => s.agentId === 'pension');
  if (payslip?.dataStatus === 'missing' && pension?.dataStatus === 'available') {
    notes.push('קיים ניתוח פנסיה מהמסלקה, אך ללא תלושי שכר — לא ניתן לאמת הפקדות שכר מול התלוש.');
  }

  return {
    notes: [...new Set(notes)],
    managementFees: slimFees,
  };
}

function actionPlanToWhatToDo(actionPlan) {
  return (actionPlan || []).map(item => ({
    title: item.agentId ? (AGENT_LABELS[item.agentId] || item.agentId) : item.action,
    action: item.action,
    agentId: item.agentId,
    priority: item.priority,
    estimatedAnnualSavings: item.estimatedAnnualSavings,
    reason: item.reason,
  }));
}

function buildMissingDataSection(agentSections) {
  return agentSections
    .filter(s => s.dataStatus === 'missing')
    .map(s => ({
      agentId: s.agentId,
      title: s.title,
      message: MISSING_HE,
      whatIsMissing: s.missingDetail?.whatIsMissing || null,
      whatEnables: s.missingDetail?.whatEnables || null,
    }));
}

function buildAgentFirstReport(packages, { scoredItems = null } = {}) {
  const { decisionByAgent, actionPlan } = synthesizeAdvisorReport(packages, { scoredItems });

  const agentSections = SPECIALIST_AGENTS.map(id =>
    buildAgentSection(id, packages[id], decisionByAgent[id] || null),
  );
  const combinedSummary = buildCombinedSummary(agentSections, packages, decisionByAgent);
  const whatToDo = actionPlanToWhatToDo(actionPlan);
  const missingData = buildMissingDataSection(agentSections);

  const analyzedCount = agentSections.filter(s => s.dataStatus === 'available').length;
  const intro = analyzedCount > 0
    ? `הדוח מבוסס על ${analyzedCount} מתוך 4 תחומים עם נתונים זמינים — החלטה אחת ברורה לכל תחום.`
    : 'טרם התקבלו נתונים מספיקים לניתוח — ראו «מידע שחסר».';

  return {
    title: 'הדוח הפיננסי האישי שלי',
    intro,
    agentSections,
    combinedSummary,
    actionPlan,
    whatToDo,
    missingData,
  };
}

module.exports = {
  buildAgentFirstReport,
  buildAgentSection,
  resolveDataStatus,
  resolveRecommendationStatus,
  preserveRecommendation,
  AGENT_LABELS,
  NO_RECS_HE,
  MISSING_HE,
  ERROR_HE,
};
