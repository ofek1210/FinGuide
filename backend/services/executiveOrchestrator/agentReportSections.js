'use strict';

const { AGENT_SOURCE_REPORT, SPECIALIST_AGENTS } = require('../../config/executiveReportConfig');
const { buildManagementFeeSection } = require('./reportCoordinator');

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

function resolveRecommendationStatus(pkg) {
  const dataStatus = resolveDataStatus(pkg);
  if (dataStatus !== 'available') return 'unavailable';
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
    for (const f of (data.marketAdvice?.funds || []).slice(0, 5)) {
      items.push({
        label: f.productName || 'מוצר',
        value: [
          f.companyName,
          f.userFee != null ? `דמ"נ ${f.userFee}%` : null,
          f.verdictLabelHe,
        ].filter(Boolean).join(' · ') || '—',
      });
    }
    for (const a of (data.advisorReport?.accounts || []).slice(0, 3)) {
      items.push({
        label: a.productName || a.accountName || 'חשבון',
        value: a.balance != null ? `₪${Math.round(a.balance).toLocaleString('he-IL')}` : (a.summaryHe || '—'),
      });
    }
  }

  if (agentId === 'insurance') {
    if (data.duplicateCount > 0) {
      items.push({ label: 'כפילויות', value: String(data.duplicateCount) });
    }
    if (data.totalMonthlyWaste > 0) {
      items.push({ label: 'בזבוז חודשי מוערך', value: `₪${Math.round(data.totalMonthlyWaste).toLocaleString('he-IL')}` });
    }
    if (data.policyCount != null) {
      items.push({ label: 'פוליסות', value: String(data.policyCount) });
    }
  }

  if (agentId === 'payslip') {
    if (data.payslipCount != null) {
      items.push({ label: 'תלושים במערכת', value: String(data.payslipCount) });
    }
  }

  return items;
}

function specialistFindings(pkg) {
  return (pkg.findings || [])
    .filter(f => f.kind !== 'strength')
    .map(f => ({
      title: f.title,
      explanation: f.explanation || '',
      severity: f.severity || null,
    }));
}

function nextActionsFromRecs(recs) {
  return recs
    .map(r => r.expectedBenefit)
    .filter(Boolean);
}

function buildAgentSection(agentId, pkg) {
  const dataStatus = resolveDataStatus(pkg);
  const recommendationStatus = resolveRecommendationStatus(pkg);
  const financialRecs = (pkg?.recommendations || [])
    .filter(r => r.itemKind !== 'missing_data')
    .map(r => preserveRecommendation(r, agentId));

  let statusMessage = null;
  if (dataStatus === 'missing') statusMessage = MISSING_HE;
  else if (dataStatus === 'error') statusMessage = ERROR_HE;
  else if (recommendationStatus === 'noRecommendations') statusMessage = NO_RECS_HE;

  const hint = MISSING_HINTS[agentId];
  const missingDetail = dataStatus === 'missing' && hint
    ? { whatIsMissing: hint.missing, whatEnables: hint.enables }
    : null;

  return {
    agentId,
    title: AGENT_LABELS[agentId] || agentId,
    dataStatus,
    recommendationStatus,
    statusMessage,
    missingDetail,
    dataSummary: buildDataSummary(agentId, pkg),
    findings: dataStatus === 'available' ? specialistFindings(pkg) : [],
    recommendations: financialRecs,
    plainLanguageExplanation: dataStatus === 'available' ? (pkg?.humanExplanation || null) : null,
    nextActions: dataStatus === 'available' ? nextActionsFromRecs(pkg?.recommendations || []) : [],
    sourceData: dataStatus === 'available' ? sourceLabel(agentId, pkg) : null,
  };
}

function buildCombinedSummary(agentSections, packages) {
  const notes = [];
  const fees = buildManagementFeeSection(packages);

  if (fees.products?.length) {
    const pensionFees = fees.products.filter(p => p.sourceAgent === 'pension');
    const gemelFees = fees.products.filter(p => p.sourceAgent === 'gemel');
    if (pensionFees.length && gemelFees.length) {
      notes.push('נמצאו ממצאים הקשורים לדמי ניהול גם בפנסיה וגם בגמל/השתלמות — כדאי לבחון כל מוצר בנפרד.');
    } else if (pensionFees.length) {
      notes.push('נמצאו ממצאים הקשורים לדמי ניהול בפנסיה.');
    } else if (gemelFees.length) {
      notes.push('נמצאו ממצאים הקשורים לדמי ניהול בגמל/השתלמות.');
    }
    if (fees.totalEstimatedAnnualExcess != null && fees.totalEstimatedAnnualExcess > 0) {
      notes.push(`סה"כ עודף שנתי מוערך בדמי ניהול (מבוסס על נתוני הסוכנים): ₪${Math.round(fees.totalEstimatedAnnualExcess).toLocaleString('he-IL')}.`);
    }
  }

  const payslip = agentSections.find(s => s.agentId === 'payslip');
  const pension = agentSections.find(s => s.agentId === 'pension');
  if (payslip?.dataStatus === 'missing' && pension?.dataStatus === 'available') {
    notes.push('קיים ניתוח פנסיה מהמסלקה, אך ללא תלושי שכר — לא ניתן לאמת הפקדות שכר מול התלוש.');
  }

  const insurance = agentSections.find(s => s.agentId === 'insurance');
  if (insurance?.dataStatus === 'available' && insurance.findings?.some(f => /כפל|כפיל/i.test(f.title))) {
    notes.push('נמצאו ממצאים ביטוחיים (כפילויות או פערים) — ראו פירוט בסעיף הביטוח.');
  }

  for (const section of agentSections) {
    if (section.recommendationStatus === 'hasRecommendations') {
      const titles = section.recommendations.map(r => r.title).slice(0, 2);
      if (titles.length) {
        notes.push(`${section.title}: ${titles.join('; ')}.`);
      }
    }
  }

  return {
    notes: [...new Set(notes)],
    managementFees: fees,
  };
}

function buildWhatToDo(agentSections) {
  const actions = [];
  for (const section of agentSections) {
    if (section.dataStatus !== 'available') continue;
    for (const rec of section.recommendations) {
      if (rec.expectedBenefit) {
        actions.push({ title: rec.title, action: rec.expectedBenefit, agentId: section.agentId });
      }
    }
    for (const step of section.nextActions) {
      if (!actions.some(a => a.action === step && a.agentId === section.agentId)) {
        actions.push({ title: section.title, action: step, agentId: section.agentId });
      }
    }
  }
  return actions;
}

function orderWhatToDoByPriority(whatToDo, scoredItems) {
  if (!scoredItems?.length || !whatToDo?.length) return whatToDo;
  const scoreByTitle = new Map(scoredItems.map(s => [s.title, s.priorityScore ?? 0]));
  return [...whatToDo].sort((a, b) => (scoreByTitle.get(b.title) ?? 0) - (scoreByTitle.get(a.title) ?? 0));
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
  const agentSections = SPECIALIST_AGENTS.map(id => buildAgentSection(id, packages[id]));
  const combinedSummary = buildCombinedSummary(agentSections, packages);
  const whatToDo = orderWhatToDoByPriority(buildWhatToDo(agentSections), scoredItems);
  const missingData = buildMissingDataSection(agentSections);

  const analyzedCount = agentSections.filter(s => s.dataStatus === 'available').length;
  const intro = analyzedCount > 0
    ? `הדוח מבוסס על ${analyzedCount} מתוך 4 תחומים עם נתונים זמינים.`
    : 'טרם התקבלו נתונים מספיקים לניתוח — ראו «מידע שחסר».';

  return {
    title: 'הדוח הפיננסי האישי שלי',
    intro,
    agentSections,
    combinedSummary,
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
  orderWhatToDoByPriority,
  AGENT_LABELS,
  NO_RECS_HE,
  MISSING_HE,
  ERROR_HE,
};
