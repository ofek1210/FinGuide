'use strict';

const {
  URGENCY_SCORE,
  SEVERITY_SCORE,
  CATEGORY_BOOST,
  MERGE_GROUPS,
  MAX_PRIORITY_ACTIONS,
} = require('../../config/executiveReportConfig');

function tokenize(text) {
  return String(text || '').toLowerCase().replace(/[^\w\u0590-\u05FF\s]/g, ' ').split(/\s+/).filter(Boolean);
}

function mergeGroupForItem(item) {
  const text = `${item.title} ${item.explanation}`;
  for (const group of MERGE_GROUPS) {
    if (group.patterns.some(p => p.test(text))) return group.key;
  }
  return item.mergeKey || item.financialCategory || 'general';
}

function computePriorityScore(item) {
  const savings = item.possibleSavings || 0;
  const impactNorm = Math.min(100, savings > 0 ? Math.log10(savings + 1) * 25 : 20);
  const sev = SEVERITY_SCORE[item.severity] ?? 40;
  const urgency = URGENCY_SCORE[item.urgency] ?? 50;
  const confidence = (item.confidence ?? 0.7) * 100;
  const categoryBoost = CATEGORY_BOOST[item.financialCategory] ?? 0;
  const retirementBoost = item.financialCategory === 'retirement' || item.financialCategory === 'pension_fees' ? 8 : 0;
  const insuranceBoost = item.financialCategory === 'insurance_waste' ? 6 : 0;

  return Math.round(
    impactNorm * 0.35
    + sev * 0.25
    + urgency * 0.2
    + confidence * 0.07
    + categoryBoost
    + retirementBoost
    + insuranceBoost,
  );
}

function impactStars(score) {
  if (score >= 85) return 5;
  if (score >= 70) return 4;
  if (score >= 55) return 3;
  if (score >= 40) return 2;
  return 1;
}

function urgencyLabel(severity, savings) {
  if (severity === 'critical' || savings >= 10000) return 'immediate';
  if (severity === 'high' || savings >= 3000) return 'soon';
  if (severity === 'medium') return 'planned';
  return 'long_term';
}

function urgencyLabelHe(urgency) {
  const map = {
    immediate: 'מיידי',
    soon: 'בקרוב',
    planned: 'בטווח של 3 חודשים',
    long_term: 'ארוך טווח',
  };
  return map[urgency] || urgency;
}

function priorityLabelHe(score) {
  if (score >= 85) return 'קריטי';
  if (score >= 70) return 'גבוה';
  if (score >= 55) return 'בינוני';
  return 'נמוך';
}

function flattenRecommendations(packages) {
  const items = [];
  for (const [agentId, pkg] of Object.entries(packages)) {
    if (!pkg || pkg.status === 'no_data') continue;
    for (const rec of pkg.recommendations || []) {
      items.push({
        ...rec,
        sourceAgents: [agentId],
        mergeGroup: mergeGroupForItem(rec),
      });
    }
  }
  return items;
}

function mergeSimilarItems(items) {
  const buckets = new Map();

  for (const item of items) {
    const key = item.mergeGroup || 'general';
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(item);
  }

  const merged = [];
  for (const [, group] of buckets) {
    if (group.length === 1) {
      merged.push(group[0]);
      continue;
    }

    group.sort((a, b) => (b.possibleSavings || 0) - (a.possibleSavings || 0));
    const primary = { ...group[0] };
    primary.sourceAgents = [...new Set(group.flatMap(g => g.sourceAgents || []))];
    primary.mergedFrom = group.length;
    primary.explanation = mergeExplanations(group);
    primary.possibleSavings = Math.max(...group.map(g => g.possibleSavings || 0));
    primary.confidence = group.reduce((s, g) => s + (g.confidence || 0), 0) / group.length;
    if (group.some(g => g.severity === 'critical')) primary.severity = 'critical';
    else if (group.some(g => g.severity === 'high')) primary.severity = 'high';
    merged.push(primary);
  }

  return merged;
}

function mergeCrossDomainCashFlow(items) {
  const insuranceIdx = items.findIndex(i => i.mergeGroup === 'insurance_cost');
  const cashIdx = items.findIndex(i => i.mergeGroup === 'cash_flow');
  if (insuranceIdx < 0 || cashIdx < 0) return items;

  const insurance = items[insuranceIdx];
  const cash = items[cashIdx];
  const merged = {
    ...insurance,
    sourceAgents: [...new Set([...(insurance.sourceAgents || []), ...(cash.sourceAgents || [])])],
    mergedFrom: (insurance.mergedFrom || 1) + (cash.mergedFrom || 1),
    explanation: 'צמצום הוצאות ביטוח מיותרות יכול לשפר מיד את תזרים המזומנים החודשי שלך.',
    possibleSavings: Math.max(insurance.possibleSavings || 0, cash.possibleSavings || 0),
    confidence: ((insurance.confidence || 0) + (cash.confidence || 0)) / 2,
    severity: insurance.severity === 'critical' || cash.severity === 'critical'
      ? 'critical'
      : insurance.severity === 'high' || cash.severity === 'high'
        ? 'high'
        : insurance.severity,
  };

  return items.filter((_, i) => i !== insuranceIdx && i !== cashIdx).concat(merged);
}

function mergeExplanations(group) {
  if (group.length <= 1) return group[0]?.explanation || '';
  const domains = [...new Set(group.flatMap(g => g.sourceAgents || []))];
  const domainHe = {
    insurance: 'ביטוח',
    payslip: 'תלוש שכר',
    pension: 'פנסיה',
    gemel: 'גמל והשתלמות',
  };
  const labels = domains.map(d => domainHe[d]).filter(Boolean);
  const base = group[0].explanation;
  if (labels.length >= 2 && /ביטוח|פרמיה|כפל/i.test(base) && domains.includes('payslip')) {
    return 'צמצום הוצאות ביטוח מיותרות יכול לשפר מיד את תזרים המזומנים החודשי שלך.';
  }
  return base;
}

function detectConflicts(items) {
  const conflicts = [];
  const hasEmergency = items.some(i => /חירום|כרית/i.test(`${i.title} ${i.explanation}`));
  const hasInvestIdle = items.some(i => /השקע|מזומן עודף|idle/i.test(`${i.title} ${i.explanation}`));

  if (hasEmergency && hasInvestIdle) {
    conflicts.push({
      id: 'emergency_vs_invest',
      title: 'כרית ביטחון מול השקעת מזומן',
      explanation: 'מומלץ קודם לוודא שיש כרית חירום לפני השקעת מזומן עודף.',
      tradeOff: 'יציבות קצרת טווח מול תשואה ארוכת טווח.',
      recommendation: 'העדיפו בניית/השלמת כרית חירום, ואז השקיעו את העודף.',
      involvedGroups: ['emergency', 'investment'],
    });
  }

  const highRiskPension = items.find(i => i.financialCategory === 'pension_fees' && (i.possibleSavings || 0) > 5000);
  const insuranceWaste = items.find(i => i.financialCategory === 'insurance_waste' && (i.possibleSavings || 0) > 0);
  if (highRiskPension && insuranceWaste) {
    const pensionAnnual = (highRiskPension.possibleSavings || 0);
    const insuranceMonthly = insuranceWaste.possibleSavings || 0;
    if (pensionAnnual > insuranceMonthly * 12) {
      conflicts.push({
        id: 'pension_vs_insurance_priority',
        title: 'עדיפות: פנסיה מול ביטוח',
        explanation: 'גם ביטוח וגם פנסיה דורשים טיפול — אך השפעת דמי הניהול בפנסיה לטווח ארוך גבוהה יותר.',
        tradeOff: 'חיסכון מיידי בפרמיות מול שיפור חיסכון עד הפרישה.',
        recommendation: 'התחילו מדמי הניהול בפנסיה, ואז טפלו בכפילויות הביטוח.',
        involvedGroups: ['pension_fees', 'insurance_cost'],
      });
    }
  }

  return conflicts;
}

function buildPriorityActions(items, conflicts) {
  const scored = items.map(item => {
    const urgency = urgencyLabel(item.severity, item.possibleSavings);
    const priorityScore = computePriorityScore({ ...item, urgency });
    return {
      ...item,
      urgency,
      urgencyLabelHe: urgencyLabelHe(urgency),
      priorityScore,
      priorityLabelHe: priorityLabelHe(priorityScore),
      impactStars: impactStars(priorityScore),
      whyNow: item.whyNow || defaultWhyNow(item, urgency),
      expectedBenefit: item.expectedBenefit || defaultBenefit(item),
      conflictNote: conflicts.find(c =>
        c.involvedGroups?.includes(item.mergeGroup)
        || c.involvedGroups?.includes(item.financialCategory),
      )?.recommendation || null,
    };
  });

  return scored
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, MAX_PRIORITY_ACTIONS)
    .map((item, index) => ({ ...item, rank: index + 1 }));
}

function defaultWhyNow(item, urgency) {
  if (urgency === 'immediate') return 'כל חודש שעובר — ההשפעה הכספית מצטברת.';
  if (item.financialCategory === 'pension_fees') return 'דמי ניהול גבוהים שוחקים את החיסכון לאורך שנים.';
  if (item.financialCategory === 'insurance_waste') return 'פרמיות מיותרות פוגעות בתזרים החודשי כבר עכשיו.';
  return 'פעולה קטנה היום יכולה לחסוך כסף משמעותי בטווח הארוך.';
}

function defaultBenefit(item) {
  if (item.possibleSavings >= 10000) return 'חיסכון משמעותי לאורך זמן';
  if (item.possibleSavings >= 1000) return 'שיפור בתזרים או בחיסכון שנתי';
  return 'שיפור במצב הפיננסי והבהירות';
}

function collectStrengths(packages) {
  const strengths = [];
  for (const pkg of Object.values(packages)) {
    strengths.push(...(pkg.strengths || []));
    if (pkg.status === 'success' && pkg.rawDataSummary) {
      const d = pkg.rawDataSummary;
      if (d.healthCheck?.score >= 70) {
        strengths.push({ title: 'בריאות פנסיונית טובה', explanation: `ציון ${d.healthCheck.score}/100` });
      }
      if (d.totalBalance > 50000) {
        strengths.push({ title: 'צבירה פנסיונית/חיסכונית מסודרת', explanation: `צבירה של כ-₪${Math.round(d.totalBalance).toLocaleString('he-IL')}` });
      }
      if (d.payslipCount >= 3) {
        strengths.push({ title: 'מעקב שוטף אחרי תלושי שכר', explanation: `${d.payslipCount} תלושים במערכת` });
      }
    }
  }
  return dedupeByTitle(strengths).slice(0, 6);
}

function collectRisks(packages, priorityActions) {
  const risks = [];
  for (const pkg of Object.values(packages)) {
    for (const f of pkg.findings || []) {
      if (f.kind === 'strength') continue;
      if (['critical', 'high', 'medium'].includes(f.severity)) {
        risks.push({ title: f.title, explanation: f.explanation, severity: f.severity });
      }
    }
  }
  for (const action of priorityActions.filter(a => a.severity === 'critical' || a.severity === 'high')) {
    risks.push({ title: action.title, explanation: action.explanation, severity: action.severity });
  }
  return dedupeByTitle(risks).slice(0, 6);
}

function collectOpportunities(packages, priorityActions) {
  const opps = [];
  for (const pkg of Object.values(packages)) {
    opps.push(...(pkg.opportunities || []));
  }
  for (const action of priorityActions) {
    opps.push({
      title: action.title,
      explanation: action.expectedBenefit || action.explanation,
      possibleSavings: action.possibleSavings,
    });
  }
  return dedupeByTitle(opps).slice(0, 6);
}

function dedupeByTitle(items) {
  const seen = new Set();
  return items.filter(i => {
    const key = i.title?.trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function runGlobalPriorityEngine(normalizedPackages) {
  const flat = flattenRecommendations(normalizedPackages);
  let merged = mergeSimilarItems(flat);
  merged = mergeCrossDomainCashFlow(merged);
  const conflicts = detectConflicts(merged);
  const priorityActions = buildPriorityActions(merged, conflicts);

  return {
    priorityActions,
    conflicts,
    strengths: collectStrengths(normalizedPackages),
    risks: collectRisks(normalizedPackages, priorityActions),
    opportunities: collectOpportunities(normalizedPackages, priorityActions),
    stats: {
      rawRecommendationCount: flat.length,
      mergedCount: merged.length,
      conflictCount: conflicts.length,
    },
  };
}

module.exports = {
  runGlobalPriorityEngine,
  computePriorityScore,
  mergeSimilarItems,
  mergeCrossDomainCashFlow,
  detectConflicts,
  urgencyLabelHe,
  priorityLabelHe,
};
