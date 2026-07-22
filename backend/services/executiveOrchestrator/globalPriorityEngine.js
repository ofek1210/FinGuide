'use strict';

const {
  SEVERITY_SCORE,
  CATEGORY_BOOST,
  MERGE_GROUPS,
  MAX_MAIN_DECISIONS,
} = require('../../config/executiveReportConfig');

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
  const confidence = (item.confidence ?? 0.7) * 100;
  const categoryBoost = CATEGORY_BOOST[item.financialCategory] ?? 0;
  const retirementBoost = item.financialCategory === 'retirement' || item.financialCategory === 'pension_fees' ? 8 : 0;
  const insuranceBoost = item.financialCategory === 'insurance_waste' ? 6 : 0;

  return Math.round(
    impactNorm * 0.4
    + sev * 0.35
    + confidence * 0.15
    + categoryBoost
    + retirementBoost
    + insuranceBoost,
  );
}

function flattenRecommendations(packages) {
  const items = [];
  for (const [agentId, pkg] of Object.entries(packages)) {
    if (!pkg || pkg.status === 'no_data') continue;
    for (const rec of pkg.recommendations || []) {
      items.push({
        ...rec,
        sourceAgents: [agentId],
        sourceReports: rec.sourceReport ? [rec.sourceReport] : [],
        originalRecommendationIds: [rec.id],
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
    primary.sourceReports = [...new Set(group.flatMap(g => g.sourceReports || []))];
    primary.originalRecommendationIds = group.map(g => g.id);
    primary.mergedFrom = group.length;
    primary.explanation = mergeExplanations(group);
    primary.possibleSavings = Math.max(...group.map(g => g.possibleSavings || 0)) || null;
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
    sourceReports: [...new Set([...(insurance.sourceReports || []), ...(cash.sourceReports || [])])],
    originalRecommendationIds: [
      ...(insurance.originalRecommendationIds || [insurance.id]),
      ...(cash.originalRecommendationIds || [cash.id]),
    ],
    mergedFrom: (insurance.mergedFrom || 1) + (cash.mergedFrom || 1),
    explanation: 'צמצום הוצאות ביטוח מיותרות יכול לשפר מיד את תזרים המזומנים החודשי שלך.',
    possibleSavings: Math.max(insurance.possibleSavings || 0, cash.possibleSavings || 0) || null,
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

function attachConflictNotes(items, conflicts) {
  return items.map(item => ({
    ...item,
    conflictNote: conflicts.find(c =>
      c.involvedGroups?.includes(item.mergeGroup)
      || c.involvedGroups?.includes(item.financialCategory),
    )?.recommendation || null,
  }));
}

function scoreAllItems(items, conflicts) {
  return items.map(item => {
    const priorityScore = computePriorityScore(item);
    return {
      ...item,
      priorityScore,
      whyItMatters: item.whyItMatters || defaultWhyItMatters(item),
      expectedBenefit: item.expectedBenefit || defaultBenefit(item),
      conflictNote: conflicts.find(c =>
        c.involvedGroups?.includes(item.mergeGroup)
        || c.involvedGroups?.includes(item.financialCategory),
      )?.recommendation || null,
    };
  }).sort((a, b) => b.priorityScore - a.priorityScore);
}

function defaultWhyItMatters(item) {
  if (item.financialCategory === 'pension_fees') return 'דמי ניהול גבוהים שוחקים את החיסכון לאורך שנים.';
  if (item.financialCategory === 'insurance_waste') return 'פרמיות מיותרות פוגעות בתזרים החודשי.';
  if (item.evidenceDeadline) return `יש מועד מוגדר: ${item.evidenceDeadline}.`;
  return 'שיפור זה יכול להשפיע על החיסכון, התזרים או ההגנה הפיננסית שלך.';
}

function defaultBenefit(item) {
  if (item.possibleSavings >= 10000) return 'חיסכון משמעותי לאורך זמן — יש לבדוק מול הספק.';
  if (item.possibleSavings >= 1000) return 'שיפור בתזרים או בחיסכון שנתי.';
  return 'שיפור במצב הפיננסי והבהירות.';
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

function collectRisks(packages) {
  const risks = [];
  for (const pkg of Object.values(packages)) {
    for (const f of pkg.findings || []) {
      if (f.kind === 'strength') continue;
      if (['critical', 'high', 'medium'].includes(f.severity)) {
        risks.push({ title: f.title, explanation: f.explanation, severity: f.severity });
      }
    }
  }
  return dedupeByTitle(risks).slice(0, 6);
}

function collectOpportunities(packages) {
  const opps = [];
  for (const pkg of Object.values(packages)) {
    opps.push(...(pkg.opportunities || []));
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
  const scoredItems = scoreAllItems(merged, conflicts);

  return {
    scoredItems,
    mainDecisionCandidates: scoredItems.slice(0, MAX_MAIN_DECISIONS),
    conflicts,
    strengths: collectStrengths(normalizedPackages),
    risks: collectRisks(normalizedPackages),
    opportunities: collectOpportunities(normalizedPackages),
    stats: {
      rawRecommendationCount: flat.length,
      mergedCount: merged.length,
      conflictCount: conflicts.length,
      preservedCount: scoredItems.length,
    },
  };
}

/** @deprecated — kept for tests that import legacy helpers */
function urgencyLabelHe() {
  return null;
}

function priorityLabelHe(score) {
  if (score >= 85) return 'גבוה';
  if (score >= 70) return 'בינוני-גבוה';
  if (score >= 55) return 'בינוני';
  return 'נמוך';
}

module.exports = {
  runGlobalPriorityEngine,
  computePriorityScore,
  mergeSimilarItems,
  mergeCrossDomainCashFlow,
  detectConflicts,
  urgencyLabelHe,
  priorityLabelHe,
  scoreAllItems,
};
