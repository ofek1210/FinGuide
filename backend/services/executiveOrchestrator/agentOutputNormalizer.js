'use strict';

const { emptyStructuredOutput, structuredRecommendation } = require('../../utils/executiveAgentSchema');
const { AGENT_SOURCE_REPORT } = require('../../config/executiveReportConfig');
const { MISSING_DATA_PATTERNS } = require('./reportCoordinator');

const URGENCY_TO_SEVERITY = { high: 'high', medium: 'medium', low: 'low' };

function parseImpactAmount(val) {
  if (val == null) return null;
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  const nums = String(val).match(/[\d,]+/g);
  if (!nums?.length) return null;
  const n = parseInt(nums.join('').replace(/,/g, ''), 10);
  return Number.isFinite(n) ? n : null;
}

function mergeKeyForText(text) {
  const t = String(text || '');
  if (/דמי ניהול|פנסיה|ניוד|איחוד/i.test(t)) return 'pension_fees';
  if (/ביטוח|פרמיה|כפל/i.test(t)) return 'insurance_cost';
  if (/השתלמות|גמל|קופת גמל/i.test(t)) return 'study_fund';
  if (/מס|החזר|תיאום/i.test(t)) return 'tax';
  if (/תזרים|חודש/i.test(t)) return 'cash_flow';
  return null;
}

function categoryFromAgent(agentId, text = '') {
  if (agentId === 'pension') return /דמי|ניהול/i.test(text) ? 'pension_fees' : 'retirement';
  if (agentId === 'gemel') return /השתלמות/i.test(text) ? 'study_fund' : 'investment';
  if (agentId === 'insurance') return /כפל|פרמיה/i.test(text) ? 'insurance_waste' : 'coverage_gap';
  if (agentId === 'payslip') return /מס/i.test(text) ? 'tax' : 'cash_flow';
  if (agentId === 'onboarding') return 'data_quality';
  return 'general';
}

function stringifyExplanation(val) {
  if (val == null) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'object') {
    if (typeof val.message === 'string') return val.message;
    if (typeof val.description === 'string') return val.description;
    if (typeof val.title === 'string') return val.title;
    if (Array.isArray(val)) return val.map(stringifyExplanation).filter(Boolean).join('; ');
    return Object.values(val).map(stringifyExplanation).filter(Boolean).join('; ');
  }
  return String(val);
}

function detectItemKind(text, agentId) {
  if (agentId === 'onboarding') return 'missing_data';
  if (MISSING_DATA_PATTERNS.some(p => p.test(text))) return 'missing_data';
  return null;
}

function sourceReportForAgent(agentId, data) {
  if (agentId === 'pension') return data?.fundAdvice?.dataSource || AGENT_SOURCE_REPORT.pension;
  if (agentId === 'gemel') return data?.marketAdvice?.sourceName || data?.marketAdvice?.dataSource || AGENT_SOURCE_REPORT.gemel;
  if (agentId === 'insurance') return AGENT_SOURCE_REPORT.insurance;
  if (agentId === 'payslip') return AGENT_SOURCE_REPORT.payslip;
  return AGENT_SOURCE_REPORT[agentId] || agentId;
}

function normalizeLegacyRec(rec, agentId, data = null) {
  const text = `${rec.title || ''} ${rec.reason || ''}`;
  const explanation = stringifyExplanation(rec.reason || rec.details || rec.title);
  const itemKind = detectItemKind(text, agentId);
  return structuredRecommendation({
    sourceId: `${agentId}-${rec.type || rec.id || rec.title}`,
    title: rec.title || 'המלצה',
    explanation,
    whyItMatters: rec.whyItMatters || null,
    expectedBenefit: rec.financialImpact || rec.nextStep || null,
    severity: URGENCY_TO_SEVERITY[rec.urgency] || 'medium',
    category: categoryFromAgent(agentId, text),
    possibleSavings: itemKind === 'missing_data' ? null : parseImpactAmount(rec.financialImpact ?? rec.impactAmount),
    confidence: (rec.confidenceScore ?? 70) / 100,
    mergeKey: mergeKeyForText(text) || rec.type,
    sourceAgent: agentId,
    sourceReport: sourceReportForAgent(agentId, data),
    itemKind,
    evidenceDeadline: rec.deadline || rec.evidenceDeadline || null,
  });
}

function normalizePrimaryRec(rec, agentId, data = null) {
  const text = `${rec.title || ''} ${rec.explanation || ''}`;
  const itemKind = detectItemKind(text, agentId);
  return structuredRecommendation({
    sourceId: rec.insightId || `${agentId}-primary-${rec.title}`,
    title: rec.title,
    explanation: rec.explanation || rec.title,
    whyItMatters: rec.whyItMatters || null,
    expectedBenefit: rec.nextStep || null,
    severity: 'high',
    category: categoryFromAgent(agentId, rec.title),
    possibleSavings: itemKind === 'missing_data' ? null : parseImpactAmount(rec.financialImpact?.amount),
    confidence: 0.85,
    mergeKey: mergeKeyForText(rec.title),
    sourceAgent: agentId,
    sourceReport: sourceReportForAgent(agentId, data),
    itemKind,
    currentState: rec.currentState || null,
    steps: rec.steps || null,
    questionsForProvider: rec.questionsForProvider || null,
  });
}

function normalizeInsight(ins, agentId) {
  const text = `${ins.title || ''} ${ins.reason || ins.finding || ''}`;
  const isPositive = ins.severity === 'info' && /טוב|מעל|תחרות/i.test(text);
  return {
    kind: isPositive ? 'strength' : ins.severity === 'info' ? 'opportunity' : 'finding',
    title: ins.title,
    explanation: ins.reason || ins.finding || ins.suggestedAction || '',
    severity: ins.severity || 'info',
    category: categoryFromAgent(agentId, text),
    possibleSavings: ins.financialImpact?.amount ?? null,
    confidence: ins.confidence ?? 0.7,
    mergeKey: mergeKeyForText(text),
  };
}

function buildAgentPackage(agentId, {
  humanExplanation = null,
  structured = null,
  legacyRecs = [],
  primaryRecs = [],
  findings = [],
  positiveFindings = [],
  additionalInsights = [],
  status = 'success',
  data = null,
}) {
  const recommendations = [
    ...primaryRecs.map(r => normalizePrimaryRec(r, agentId, data)),
    ...legacyRecs.map(r => normalizeLegacyRec(r, agentId, data)),
  ];

  const allFindings = [
    ...findings.map(f => normalizeInsight({ ...f, reason: f.details || f.reason }, agentId)),
    ...(structured?.findings || []).map(f => normalizeInsight(f, agentId)),
  ];

  const strengths = positiveFindings.map(p => normalizeInsight(p, agentId));
  const opportunities = additionalInsights
    .filter(i => i.severity === 'info' || i.severity === 'low')
    .map(i => normalizeInsight(i, agentId));

  const maxSeverity = recommendations.reduce((best, r) => {
    const order = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };
    return (order[r.severity] ?? 0) > (order[best] ?? 0) ? r.severity : best;
  }, 'info');

  const structuredOutput = structured || emptyStructuredOutput({
    findings: allFindings,
    recommendations,
    severity: maxSeverity,
    confidence: recommendations.length
      ? recommendations.reduce((s, r) => s + r.confidence, 0) / recommendations.length
      : 0,
    financialCategory: recommendations[0]?.financialCategory || categoryFromAgent(agentId),
    possibleSavings: recommendations.reduce((max, r) => Math.max(max, r.possibleSavings || 0), 0) || null,
  });

  return {
    agentId,
    status,
    humanExplanation,
    structured: structuredOutput,
    recommendations,
    findings: allFindings,
    strengths,
    opportunities,
    rawDataSummary: data,
  };
}

function normalizeOnboardingPackage(canvas, profileAgent) {
  const onboarding = canvas?.onboarding || {};
  const profile = profileAgent?.data?.profile || {};
  const humanExplanation = canvas?.summaryHe
    || (profileAgent?.recommendations?.length
      ? 'פרופיל האונבורדינג מספק הקשר אישי לכל ההמלצות.'
      : null);

  const legacyRecs = (profileAgent?.recommendations || []).map(r => ({
    ...r,
    reason: r.title,
  }));

  const missingFromInventory = Object.entries(canvas?.dataInventory || {})
    .filter(([, v]) => v === false)
    .map(([k]) => ({
      type: `missing-${k}`,
      title: missingDataTitleForKey(k),
      reason: missingDataReasonForKey(k),
    }));

  return buildAgentPackage('onboarding', {
    humanExplanation,
    legacyRecs: [...legacyRecs, ...missingFromInventory],
    status: profileAgent?.status || 'success',
    data: { onboarding, profile, riskProfile: profileAgent?.data?.riskProfile, dataInventory: canvas?.dataInventory },
    structured: emptyStructuredOutput({
      financialCategory: 'data_quality',
      findings: [],
    }),
  });
}

function missingDataTitleForKey(key) {
  const map = {
    payslips: 'העלאת תלושי שכר',
    pension: 'העלאת דוח מסלקה פנסיונית',
    insurance: 'העלאת דוח הר הביטוח',
    gemel: 'העלאת נתוני גמל/השתלמות',
    expenses: 'הוספת הוצאות חודשיות',
    goals: 'הגדרת מטרות פיננסיות',
  };
  return map[key] || `השלמת נתונים: ${key}`;
}

function missingDataReasonForKey(key) {
  const map = {
    payslips: 'תלושי שכר נדרשים לניתוח הפקדות, מס ותזרים.',
    pension: 'דוח מסלקה מאפשר ניתוח פנסיה מלא.',
    insurance: 'דוח הר הביטוח מאפשר ניתוח כיסויים וכפילויות.',
    gemel: 'נתוני גמל/השתלמות נדרשים להשוואת דמי ניהול.',
    expenses: 'הוצאות חודשיות משפרות את תמונת התזרים.',
    goals: 'מטרות פיננסיות מסייעות בהתאמת ההמלצות.',
  };
  return map[key] || 'מידע זה נדרש להשלמת התמונה הפיננסית.';
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  return [];
}

function payslipAnomalyFindings(anomalies) {
  if (!anomalies) return [];
  if (Array.isArray(anomalies)) {
    return anomalies.map(a => ({
      title: a.title || 'חריגה בתלוש',
      finding: a.description || a.message || String(a),
      severity: a.severity || 'warning',
    }));
  }
  const list = asArray(anomalies.anomalies);
  if (!anomalies.hasAnomalies && !list.length) return [];
  return list.map(item => (
    typeof item === 'string'
      ? { title: 'חריגה בתלוש', finding: item, severity: 'warning' }
      : {
        title: item.title || 'חריגה בתלוש',
        finding: item.description || item.message || '',
        severity: item.severity || 'warning',
      }
  ));
}

function normalizePayslipAgent(agent) {
  if (!agent || agent.status === 'no_data') {
    return buildAgentPackage('payslip', { status: 'no_data', humanExplanation: agent?.message });
  }
  if (agent.status === 'error') {
    return buildAgentPackage('payslip', {
      status: 'error',
      humanExplanation: agent.error || agent.message || 'שגיאה בטעינת נתוני תלוש',
    });
  }
  return buildAgentPackage('payslip', {
    humanExplanation: agent.llmExplanation,
    legacyRecs: asArray(agent.recommendations),
    status: agent.status,
    data: agent.data,
    findings: payslipAnomalyFindings(agent.data?.anomalies),
  });
}

function normalizeInsuranceAgent(agent) {
  if (!agent || agent.status === 'no_data') {
    return buildAgentPackage('insurance', { status: 'no_data', humanExplanation: agent?.message });
  }
  if (agent.status === 'error') {
    return buildAgentPackage('insurance', {
      status: 'error',
      humanExplanation: agent.error || agent.message || 'שגיאה בטעינת נתוני ביטוח',
    });
  }
  const findings = [];
  if (agent.data?.duplicateCount > 0) {
    findings.push({
      title: 'כפילויות ביטוח',
      finding: `זוהו ${agent.data.duplicateCount} כפילויות — בזבוז של כ-₪${Math.round(agent.data.totalMonthlyWaste || 0)} בחודש`,
      severity: 'high',
    });
  }
  for (const gap of asArray(agent.data?.missingCoverage)) {
    findings.push({
      title: gap.title || 'כיסוי חסר',
      finding: gap.description || gap.reason || '',
      severity: gap.urgency === 'critical' ? 'critical' : 'medium',
    });
  }
  return buildAgentPackage('insurance', {
    humanExplanation: agent.llmExplanation,
    legacyRecs: asArray(agent.recommendations),
    findings,
    status: agent.status,
    data: agent.data,
  });
}

function normalizePensionAgent(agent) {
  if (!agent || agent.status === 'no_data') {
    return buildAgentPackage('pension', { status: 'no_data', humanExplanation: agent?.message });
  }
  if (agent.status === 'error') {
    return buildAgentPackage('pension', {
      status: 'error',
      humanExplanation: agent.error || agent.message || 'שגיאה בטעינת נתוני פנסיה',
    });
  }
  return buildAgentPackage('pension', {
    humanExplanation: agent.llmExplanation,
    legacyRecs: asArray(agent.recommendations),
    primaryRecs: asArray(agent.primaryRecommendations),
    findings: asArray(agent.structuredInsights),
    positiveFindings: asArray(agent.positiveFindings),
    additionalInsights: asArray(agent.additionalInsights),
    status: agent.status,
    data: agent.data,
  });
}

function normalizeGemelAgent(agent) {
  if (!agent || agent.status === 'no_data') {
    return buildAgentPackage('gemel', { status: 'no_data', humanExplanation: agent?.message });
  }
  if (agent.status === 'error') {
    return buildAgentPackage('gemel', {
      status: 'error',
      humanExplanation: agent.error || agent.message || 'שגיאה בטעינת נתוני גמל',
    });
  }

  const orch = agent.data?.advisorReport?.orchestrator;
  const mapOrchRec = r => ({
    type: r.type || r.id,
    title: r.title,
    reason: r.explanation,
    urgency: r.severity === 'high' || r.severity === 'critical' ? 'high' : 'medium',
    financialImpact: r.possibleSavings != null ? `₪${r.possibleSavings}` : null,
    impactAmount: r.possibleSavings,
    confidenceScore: Math.round((r.confidence || 0.7) * 100),
  });

  const orchRecs = (orch?.recommendations || []).map(mapOrchRec);
  const advisorRecs = (agent.data?.advisorReport?.recommendations || []).map(r => ({
    type: r.type || r.id || r.title,
    title: r.title,
    reason: r.explanation || r.reason || r.summaryHe,
    urgency: r.severity === 'high' ? 'high' : 'medium',
    impactAmount: r.possibleSavings ?? r.annualSavingsEstimate,
    financialImpact: r.possibleSavings != null ? `₪${r.possibleSavings}` : null,
  }));

  const primaryRecs = asArray(agent.primaryRecommendations);
  const legacyFromAgent = asArray(agent.recommendations);
  const legacyRecs = primaryRecs.length
    ? [...advisorRecs.filter(ar => !legacyFromAgent.some(l => l.title === ar.title)), ...legacyFromAgent]
    : (orchRecs.length ? orchRecs : [...advisorRecs, ...legacyFromAgent]);

  return buildAgentPackage('gemel', {
    humanExplanation: agent.llmExplanation || agent.data?.advisorReport?.humanSummary,
    legacyRecs,
    primaryRecs,
    findings: [
      ...asArray(agent.structuredInsights),
      ...asArray(agent.data?.payslipFindings).map(f => ({
        title: f.title,
        finding: f.details,
        severity: f.severity === 'critical' ? 'high' : f.severity,
      })),
    ],
    positiveFindings: asArray(agent.positiveFindings),
    additionalInsights: asArray(agent.additionalInsights),
    status: agent.status,
    data: agent.data,
  });
}

function normalizeAllAgentOutputs({ agentResults, canvas, profileAgent }) {
  return {
    onboarding: normalizeOnboardingPackage(canvas, profileAgent),
    payslip: normalizePayslipAgent(agentResults.payslip),
    insurance: normalizeInsuranceAgent(agentResults.insurance),
    pension: normalizePensionAgent(agentResults.pension),
    gemel: normalizeGemelAgent(agentResults.gemel),
  };
}

module.exports = {
  normalizeAllAgentOutputs,
  buildAgentPackage,
  normalizeLegacyRec,
  parseImpactAmount,
  categoryFromAgent,
  mergeKeyForText,
};
