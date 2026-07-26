'use strict';

const {
  MATERIALITY_ANNUAL_NIS,
  AGENT_SOURCE_REPORT,
  SPECIALIST_AGENTS,
} = require('../../config/executiveReportConfig');

const MISSING_DATA_PATTERNS = [
  /העל(ה|ו|י)\s*(תלוש|דוח|מסמך)/i,
  /העלאת\s*תלוש/i,
  /השלימ(ו|י)\s*(פרופיל|אונבורדינג|שאלון|נתונים)/i,
  /הגדר(ו|י)\s*מטר/i,
  /הוסיפ(ו|י)\s*הוצא/i,
  /הר\s*ה?ביטוח/i,
  /har\s*habituach/i,
  /מסלקה/i,
  /clearinghouse/i,
  /חסרים?\s*נתונ/i,
  /אין\s*תלוש/i,
  /לא\s*נמצאו\s*נתונ/i,
  /השלמת\s*התמונה/i,
  /העלה\s*דוח/i,
  /השלם\s*אונבורדינג/i,
];

const BEFORE_CHANGE_PATTERNS = [
  /ניוד|מעבר|העבר(ה|ת)|החלפ(ה|ת)\s*מסלול|החלפת\s*קרן/i,
  /ביטול\s*פוליס/i,
  /שינוי\s*מסלול/i,
];

const TRANSFER_PATTERNS = [/ניוד|מעבר|העבר(ה|ת)\s*קרן|העברת\s*פנסיה/i];

function isMissingDataItem(item) {
  if (item.itemKind === 'missing_data') return true;
  if (item.sourceAgents?.includes('onboarding') && !item.possibleSavings) return true;
  const text = `${item.title || ''} ${item.explanation || ''}`;
  return MISSING_DATA_PATTERNS.some(p => p.test(text));
}

function isBeforeChangeItem(item) {
  const text = `${item.title || ''} ${item.explanation || ''}`;
  return BEFORE_CHANGE_PATTERNS.some(p => p.test(text));
}

function annualizeSavings(item) {
  const savings = item.possibleSavings;
  if (savings == null || !Number.isFinite(savings)) return null;
  const text = `${item.title || ''} ${item.explanation || ''} ${item.expectedBenefit || ''}`;
  if (/\/\s*חודש|חודשי|בחודש/i.test(text)) return savings * 12;
  return savings;
}

function isMaterial(item) {
  const annual = annualizeSavings(item);
  if (annual == null) return item.severity === 'critical' || item.severity === 'high';
  return annual >= MATERIALITY_ANNUAL_NIS;
}

function immaterialReason(item) {
  const annual = annualizeSavings(item);
  if (annual == null) return null;
  if (annual < MATERIALITY_ANNUAL_NIS) {
    return `ההפרש מוערך בכ-₪${Math.round(annual).toLocaleString('he-IL')} בשנה — לא מספיק מהותי כדי להציג כהחלטה מרכזית לבדו.`;
  }
  return null;
}

function classifyItem(item, rankAmongFinancial) {
  if (isMissingDataItem(item)) {
    return { classification: 'missingData', decisionBucket: 'missingData' };
  }

  const material = isMaterial(item);
  if (!material) {
    return {
      classification: 'notMaterial',
      decisionBucket: 'checkLater',
      immaterialReason: immaterialReason(item),
    };
  }

  if (isBeforeChangeItem(item)) {
    return { classification: 'mainDecision', decisionBucket: 'beforeChange' };
  }

  if (rankAmongFinancial <= 5 && (item.severity === 'critical' || item.severity === 'high' || (item.possibleSavings || 0) >= 1000)) {
    return { classification: 'mainDecision', decisionBucket: 'doNow' };
  }

  if (item.severity === 'medium' || (item.possibleSavings || 0) >= MATERIALITY_ANNUAL_NIS) {
    return { classification: 'additionalFinding', decisionBucket: 'checkLater' };
  }

  return { classification: 'monitoringItem', decisionBucket: 'checkLater' };
}

function buildMonetaryImpact(item) {
  const savings = item.possibleSavings;
  if (savings == null || !Number.isFinite(savings) || savings <= 0) {
    return { hasImpact: false, summary: null, assumptions: [], disclaimer: null };
  }

  const text = `${item.title || ''} ${item.explanation || ''}`;
  const isMonthly = /\/\s*חודש|חודשי|בחודש/i.test(text);
  const annual = isMonthly ? savings * 12 : savings;

  const assumptions = [];
  if (isMonthly) {
    assumptions.push(`הערכה חודשית של ₪${Math.round(savings).toLocaleString('he-IL')}`);
    assumptions.push('הכפלה ל-12 חודשים לצורך השוואה שנתית');
  } else {
    assumptions.push(`הערכה שנתית/מצטברת של ₪${Math.round(savings).toLocaleString('he-IL')}`);
  }
  if (/פנסיה|פרישה|30\s*שנ/i.test(text)) {
    assumptions.push('מבוסס על נתוני צבירה, הפקדות ו/או תקופת חיסכון מהסוכן');
  }
  if (/דמי ניהול/i.test(text)) {
    assumptions.push('מבוסס על דמי ניהול נוכחיים מול ערך השוואה מהסוכן');
  }

  return {
    hasImpact: true,
    summary: isMonthly
      ? `השפעה מוערכת: כ-₪${Math.round(savings).toLocaleString('he-IL')} בחודש (כ-₪${Math.round(annual).toLocaleString('he-IL')} בשנה)`
      : `השפעה מוערכת: כ-₪${Math.round(annual).toLocaleString('he-IL')}`,
    annualAmount: annual,
    assumptions,
    disclaimer: 'התחזית אינה תשואה מובטחת ומבוססת על הנתונים שהוזנו למערכת.',
  };
}

function defaultSteps(item) {
  const text = `${item.title || ''} ${item.explanation || ''}`;
  if (/דמי ניהול/i.test(text)) {
    return [
      'לבקש מהגוף המנהל את דמי הניהול המדויקים מהפקדה ומצבירה.',
      'להשוות מול ערך השוק או הצעה מתחרה.',
      'לוודא השלכות ביטוחיות ומס לפני שינוי.',
    ];
  }
  if (/ביטוח|פרמיה|כפל/i.test(text)) {
    return [
      'לבקש פירוט כיסויים ופרמיות מכל המבטחים.',
      'לזהות כפילויות או כיסויים חסרים.',
      'לבקש הצעת מחיר מחודשת לפני ביטול.',
    ];
  }
  if (/מסלול|השקע/i.test(text)) {
    return [
      'לבקש את שם המסלול המדויק וחשיפה לנכסים.',
      'להשוות מול מסלול התואם את פרופיל הסיכון.',
      'לוודא דמי ניהול וכיסוי ביטוחי לפני מעבר.',
    ];
  }
  return [
    'לאסוף את המסמכים הרלוונטיים מהספק.',
    'להשוות מול החלופות שמופיעות בדוח.',
    'לעדכן את FinGuide לאחר קבלת תשובה.',
  ];
}

function defaultQuestions(item) {
  const text = `${item.title || ''} ${item.explanation || ''}`;
  if (/דמי ניהול|פנסיה|גמל|השתלמות/i.test(text)) {
    return [
      'מה דמי הניהול המדויקים מהפקדה ומצבירה?',
      'האם יש הלוואות, עיקולים או הגבלות נזילות?',
      'מה ההשלכות על כיסוי ביטוחי במסגרת המוצר?',
    ];
  }
  if (/ביטוח/i.test(text)) {
    return [
      'מה הכיסויים, ההשתתפויות העצמיות והחריגים?',
      'מתי מסתיים/מתחדש החוזה?',
      'האם יש כיסוי מקביל במקום אחר?',
    ];
  }
  return ['מה המצב הנוכחי?', 'מה האפשרויות לשיפור?', 'מה עלות המעבר או השינוי?'];
}

function buildDecisionCard(item, meta = {}) {
  const impact = buildMonetaryImpact(item);
  return {
    id: item.id,
    title: item.title,
    sourceAgents: item.sourceAgents || [],
    sourceReports: item.sourceReports || [],
    originalRecommendationIds: item.originalRecommendationIds || [item.id],
    dataDate: item.dataDate || null,
    confidence: item.confidence ?? null,
    classification: meta.classification,
    currentState: item.currentState || 'מבוסס על הנתונים הזמינים — ייתכן שיידרש אימות מול הספק.',
    finding: item.explanation,
    whyItMatters: item.whyItMatters || item.whyNow || 'שיפור זה יכול להשפיע על החיסכון, התזרים או ההגנה הפיננסית שלך.',
    monetaryImpact: impact,
    recommendedAction: item.expectedBenefit || 'לבחון את ההמלצה מול הספק או יועץ מוסמך.',
    steps: item.steps || defaultSteps(item),
    questionsForProvider: item.questionsForProvider || defaultQuestions(item),
    immaterialReason: meta.immaterialReason || null,
    conflictNote: item.conflictNote || null,
    evidenceDeadline: item.evidenceDeadline || null,
  };
}

function buildActionItem(item) {
  const text = `${item.title || ''} ${item.explanation || ''}`;
  let whoToContact = 'הספק הרלוונטי (מעסיק / חברת ביטוח / גוף מנהל)';
  if (/פנסיה|גמל|השתלמות/i.test(text)) whoToContact = 'גוף מנהל הפנסיה/גמל או יועץ פנסיוני';
  if (/ביטוח/i.test(text)) whoToContact = 'סוכן הביטוח או חברת הביטוח';
  if (/תלוש|מס/i.test(text)) whoToContact = 'מחלקת שכר / רואה חשבון';

  return {
    title: item.title,
    explanation: item.explanation,
    whoToContact,
    whatToRequest: defaultQuestions(item)[0],
    whatToCompare: /דמי ניהול/i.test(text) ? 'דמי ניהול מול ערך השוק' : 'המצב הנוכחי מול החלופות בדוח',
    documentToAttach: isMissingDataItem(item) ? item.title : null,
    returnToFinGuide: isMissingDataItem(item) ? 'לאחר העלאה — לרענן את הניתוח ב-Hub' : null,
    sourceAgents: item.sourceAgents || [],
  };
}

function agentReportLabel(agentId, pkg) {
  const data = pkg?.rawDataSummary;
  if (agentId === 'pension') {
    return data?.fundAdvice?.dataSource || AGENT_SOURCE_REPORT.pension;
  }
  if (agentId === 'gemel') {
    return data?.marketAdvice?.sourceName || data?.marketAdvice?.dataSource || AGENT_SOURCE_REPORT.gemel;
  }
  if (agentId === 'insurance') return AGENT_SOURCE_REPORT.insurance;
  if (agentId === 'payslip') return AGENT_SOURCE_REPORT.payslip;
  return AGENT_SOURCE_REPORT[agentId] || agentId;
}

function buildPersonalOverview(packages, classifiedItems, globalScore) {
  const analyzedDomains = SPECIALIST_AGENTS.filter(id => packages[id]?.status === 'success');
  const completedAgents = analyzedDomains;
  const missingSources = [];

  for (const [agentId, pkg] of Object.entries(packages)) {
    if (agentId === 'onboarding') continue;
    if (pkg?.status === 'no_data') {
      missingSources.push({
        agentId,
        label: agentReportLabel(agentId, pkg),
        message: pkg.humanExplanation || `חסרים נתונים מ${AGENT_SOURCE_REPORT[agentId] || agentId}`,
      });
    }
  }

  const financialItems = classifiedItems.filter(i => i.classification !== 'missingData');
  const mainDecisions = classifiedItems.filter(i => i.classification === 'mainDecision');
  const missingData = classifiedItems.filter(i => i.classification === 'missingData');

  const overview = {
    analyzedDomains,
    availableReports: analyzedDomains.map(id => agentReportLabel(id, packages[id])),
    completedAgents,
    findingCount: financialItems.length,
    materialOpportunityCount: mainDecisions.length,
    missingSources,
    missingDataCount: missingData.length,
  };

  if (globalScore?.score != null) {
    overview.healthScore = {
      score: globalScore.score,
      label: globalScore.label || null,
      howCalculated: 'סכום 5 קטגוריות: שלמות מסמכים (25), יציבות שכר (20), מוכנות מס (20), עקביות פנסיה (20), ביטוח וסיכון (15).',
      categories: (globalScore.categories || []).map(c => ({
        name: c.name,
        score: c.score,
        maxScore: c.maxScore,
        messages: c.messages || [],
      })),
      missingData: (globalScore.categories || [])
        .flatMap(c => (c.messages || []).filter(m => /חסר|לא נמצא|מומלץ להעלות/i.test(m))),
      pointsLost: (globalScore.categories || [])
        .filter(c => c.maxScore && c.score < c.maxScore)
        .map(c => `${c.name}: ${c.maxScore - c.score} נקודות`),
      confidence: globalScore.categories?.length >= 4 ? 'בינונית-גבוהה' : 'בינונית',
      disclaimer: globalScore.disclaimer || null,
    };
  }

  return overview;
}

function buildCurrentPosition(packages) {
  const position = { items: [], disclaimer: 'מוצגים רק ערכים שסופקו על ידי הסוכנים — לא נוצרו נתונים שלא קיימים.' };
  const pension = packages.pension?.rawDataSummary;
  const gemel = packages.gemel?.rawDataSummary;
  const insurance = packages.insurance?.rawDataSummary;
  const payslip = packages.payslip?.rawDataSummary;

  if (pension?.projection?.projectedAccumulation != null) {
    position.items.push({
      label: 'צבירה פנסיונית צפויה לפרישה',
      value: pension.projection.projectedAccumulation,
      formatted: `₪${Math.round(pension.projection.projectedAccumulation).toLocaleString('he-IL')}`,
      sourceAgent: 'pension',
    });
  }
  if (pension?.projection?.monthlyPensionEstimate != null) {
    position.items.push({
      label: 'קצבה חודשית צפויה',
      value: pension.projection.monthlyPensionEstimate,
      formatted: `₪${Math.round(pension.projection.monthlyPensionEstimate).toLocaleString('he-IL')}`,
      sourceAgent: 'pension',
    });
  }
  if (pension?.totalMonthlyContribution != null) {
    position.items.push({
      label: 'הפקדה חודשית לפנסיה',
      value: pension.totalMonthlyContribution,
      formatted: `₪${Math.round(pension.totalMonthlyContribution).toLocaleString('he-IL')}`,
      sourceAgent: 'pension',
    });
  }
  if (gemel?.totalBalance != null) {
    position.items.push({
      label: 'יתרה בגמל והשתלמות',
      value: gemel.totalBalance,
      formatted: `₪${Math.round(gemel.totalBalance).toLocaleString('he-IL')}`,
      sourceAgent: 'gemel',
    });
  }
  if (gemel?.totalMonthlyContribution != null) {
    position.items.push({
      label: 'הפקדה חודשית לגמל/השתלמות',
      value: gemel.totalMonthlyContribution,
      formatted: `₪${Math.round(gemel.totalMonthlyContribution).toLocaleString('he-IL')}`,
      sourceAgent: 'gemel',
    });
  }
  if (insurance?.totalMonthlyWaste != null && insurance.totalMonthlyWaste > 0) {
    position.items.push({
      label: 'בזבוז ביטוחי מוערך (חודשי)',
      value: insurance.totalMonthlyWaste,
      formatted: `₪${Math.round(insurance.totalMonthlyWaste).toLocaleString('he-IL')}`,
      sourceAgent: 'insurance',
    });
  }
  if (payslip?.payslipCount != null) {
    position.items.push({
      label: 'תלושי שכר במערכת',
      value: payslip.payslipCount,
      formatted: String(payslip.payslipCount),
      sourceAgent: 'payslip',
    });
  }

  return position;
}

function buildManagementFeeSection(packages) {
  const products = [];

  const pensionFunds = packages.pension?.rawDataSummary?.fundAdvice?.funds || [];
  for (const f of pensionFunds) {
    if (f.userFee == null && f.gainIfSwitch == null) continue;
    products.push({
      product: f.fundName || 'פנסיה',
      productType: 'pension',
      balance: f.balance ?? null,
      currentFee: f.userFee ?? null,
      comparisonValue: f.marketFee ?? null,
      estimatedAnnualExcess: f.gainIfSwitch ?? null,
      conclusion: f.verdictLabelHe || f.verdict || null,
      sourceAgent: 'pension',
      material: (f.gainIfSwitch ?? 0) >= MATERIALITY_ANNUAL_NIS,
    });
  }

  const gemelFunds = packages.gemel?.rawDataSummary?.marketAdvice?.funds || [];
  for (const f of gemelFunds) {
    products.push({
      product: f.productName || 'גמל/השתלמות',
      productType: /השתלמות/i.test(f.productName || '') ? 'hishtalmut' : 'gemel',
      balance: f.balance ?? null,
      currentFee: f.userFee ?? null,
      comparisonValue: f.marketFee ?? null,
      estimatedAnnualExcess: f.annualSavingsEstimate ?? null,
      conclusion: f.verdictLabelHe || f.verdict || null,
      sourceAgent: 'gemel',
      material: (f.annualSavingsEstimate ?? 0) >= MATERIALITY_ANNUAL_NIS,
    });
  }

  const advisorAccounts = packages.gemel?.rawDataSummary?.advisorReport?.accounts || [];
  for (const a of advisorAccounts) {
    if (a.managementFeeBalancePct == null && a.possibleSavings == null) continue;
    products.push({
      product: a.productName || a.accountName || 'חיסכון',
      productType: a.productType || 'investment_gemel',
      balance: a.balance ?? null,
      currentFee: a.managementFeeBalancePct ?? null,
      comparisonValue: a.marketFeePct ?? null,
      estimatedAnnualExcess: a.possibleSavings ?? null,
      conclusion: a.summaryHe || null,
      sourceAgent: 'gemel',
      material: (a.possibleSavings ?? 0) >= MATERIALITY_ANNUAL_NIS,
    });
  }

  const withExcess = products.filter(p => p.estimatedAnnualExcess != null && p.estimatedAnnualExcess > 0);
  const totalExcess = withExcess.reduce((s, p) => s + (p.estimatedAnnualExcess || 0), 0);
  const largest = withExcess.sort((a, b) => (b.estimatedAnnualExcess || 0) - (a.estimatedAnnualExcess || 0))[0] || null;
  const worthNegotiating = withExcess.filter(p => p.material);
  const immaterial = withExcess.filter(p => !p.material);

  return {
    products,
    totalEstimatedAnnualExcess: totalExcess > 0 ? totalExcess : null,
    largestExcessProduct: largest?.product || null,
    worthNegotiating: worthNegotiating.map(p => p.product),
    immaterialProducts: immaterial.map(p => ({
      product: p.product,
      reason: `ההפרש מוערך בכ-₪${Math.round(p.estimatedAnnualExcess || 0).toLocaleString('he-IL')} בשנה — לא מהותי לבדו.`,
    })),
    disclaimer: 'הערכות מבוססות על נתוני הסוכנים. יש לאמת דמי ניהול בפועל מול הספק.',
  };
}

function buildInsuranceSummary(packages) {
  const insurance = packages.insurance?.rawDataSummary;
  const pension = packages.pension?.rawDataSummary;
  const summary = {
    pensionEmbedded: [],
    privatePolicies: [],
    crossDomainNotes: [],
    sources: [],
  };

  if (packages.insurance?.status === 'success') {
    summary.sources.push(AGENT_SOURCE_REPORT.insurance);
    if (insurance?.duplicateCount > 0) {
      summary.privatePolicies.push({
        title: 'כפילויות ביטוח',
        detail: `${insurance.duplicateCount} כפילויות — בזבוז של כ-₪${Math.round(insurance.totalMonthlyWaste || 0)} בחודש`,
      });
    }
    for (const gap of (insurance?.missingCoverage || [])) {
      summary.privatePolicies.push({
        title: gap.title || 'כיסוי חסר',
        detail: gap.description || gap.reason || '',
      });
    }
  }

  if (packages.pension?.status === 'success') {
    summary.sources.push(AGENT_SOURCE_REPORT.pension);
    summary.pensionEmbedded.push({
      title: 'כיסויים במסגרת פנסיה',
      detail: 'יש לוודא כיסוי שאירים/נכות מול מצב משפחתי — פרטים בדוח הפנסיה.',
    });
    if (pension?.fundAdvice?.funds?.some(f => TRANSFER_PATTERNS.some(p => p.test(f.verdictLabelHe || '')))) {
      summary.crossDomainNotes.push('מעבר פנסיה עלול להשפיע על רציפות כיסוי ביטוחי — יש לבדוק לפני שינוי.');
    }
  }

  return summary;
}

function buildPayslipFindingsSection(packages) {
  if (packages.payslip?.status !== 'success') return { hasData: false, findings: [] };
  const findings = (packages.payslip.findings || [])
    .filter(f => f.kind !== 'strength')
    .map(f => ({
      title: f.title,
      explanation: f.explanation,
      severity: f.severity,
      sourceAgent: 'payslip',
      sourceReport: AGENT_SOURCE_REPORT.payslip,
    }));
  return { hasData: findings.length > 0, findings };
}

function buildProductAlternatives(packages) {
  const alternatives = [];

  for (const f of (packages.pension?.rawDataSummary?.fundAdvice?.funds || [])) {
    for (const alt of (f.alternatives || [])) {
      alternatives.push({
        productOrTrack: alt.name || alt.trackName || 'חלופה',
        managementFees: alt.fees ?? alt.managementFee ?? null,
        riskLevel: alt.riskLevel ?? null,
        comparisonPerformance: alt.returnPercentile ?? alt.performance ?? null,
        fitNotes: alt.summaryHe || alt.fit || null,
        tradeoffs: alt.tradeoffs || 'יש לאמת דמי ניהול, ביטוח, נזילות והלוואות לפני מעבר.',
        sourceAgent: 'pension',
        dataDate: packages.pension?.rawDataSummary?.fundAdvice?.dataDate || null,
        verificationRequired: [
          'דמי ניהול בפועל', 'מסלול נוכחי', 'השלכות ביטוח', 'הגבלות נזילות', 'הלוואות', 'מס', 'תנאי ספק',
        ],
      });
    }
  }

  for (const f of (packages.gemel?.rawDataSummary?.marketAdvice?.funds || [])) {
    for (const alt of (f.alternatives || [])) {
      alternatives.push({
        productOrTrack: alt.productName || alt.name || 'חלופה',
        managementFees: alt.userFee ?? alt.managementFee ?? null,
        riskLevel: alt.riskLevel ?? null,
        comparisonPerformance: alt.returnPercentile ?? null,
        fitNotes: alt.summaryHe || null,
        tradeoffs: 'תשואות עבר אינן מבטיחות תשואה עתידית — נדרש אימות מול הספק.',
        sourceAgent: 'gemel',
        dataDate: packages.gemel?.rawDataSummary?.marketAdvice?.dataDate || null,
        verificationRequired: [
          'דמי ניהול בפועל', 'מסלול נוכחי', 'הגבלות נזילות', 'מס', 'תנאי ספק',
        ],
      });
    }
  }

  return alternatives;
}

function buildUserSummary(overview, mainDecisions, missingData) {
  const parts = [];
  parts.push(`נותחו ${overview.analyzedDomains.length} תחומים: ${overview.availableReports.join(', ') || '—'}.`);
  if (overview.materialOpportunityCount > 0) {
    parts.push(`זוהו ${overview.materialOpportunityCount} הזדמנויות שיפור מהותיות.`);
  }
  if (mainDecisions[0]) {
    parts.push(`החלטה מרכזית: ${mainDecisions[0].title}.`);
  }
  if (missingData.length) {
    parts.push(`${missingData.length} פריטי מידע חסרים — לא מעורבים בהמלצות פיננסיות.`);
  }
  parts.push('הדוח מסודר לפי מה כדאי לעשות, מה לבדוק לפני שינוי, ומה ניתן לבדוק בהמשך.');
  return parts.join(' ');
}

function runReportCoordinator({ packages, scoredItems, conflicts, globalScore }) {
  const financialRanked = scoredItems
    .filter(i => !isMissingDataItem(i))
    .sort((a, b) => b.priorityScore - a.priorityScore);

  const classifiedItems = scoredItems.map(item => {
    const isMissing = isMissingDataItem(item);
    const rankAmongFinancial = isMissing
      ? 999
      : financialRanked.findIndex(f => f.id === item.id) + 1;
    const { classification, decisionBucket, immaterialReason: immReason } = classifyItem(
      item,
      rankAmongFinancial,
    );
    return {
      ...item,
      classification,
      decisionBucket,
      immaterialReason: immReason,
      rankAmongFinancial: isMissing ? null : rankAmongFinancial,
    };
  });

  const mainDecisions = classifiedItems
    .filter(i => i.classification === 'mainDecision')
    .map(i => buildDecisionCard(i, { classification: i.classification }));

  const allRecommendations = classifiedItems.map(i => ({
    id: i.id,
    title: i.title,
    explanation: i.explanation,
    classification: i.classification,
    decisionBucket: i.decisionBucket,
    sourceAgents: i.sourceAgents || [],
    sourceReports: i.sourceReports || [],
    originalRecommendationIds: i.originalRecommendationIds || [i.id],
    dataDate: i.dataDate || null,
    confidence: i.confidence ?? null,
    possibleSavings: i.possibleSavings ?? null,
    immaterialReason: i.immaterialReason || null,
    monetaryImpact: buildMonetaryImpact(i),
  }));

  const actionPlan = {
    doNow: classifiedItems.filter(i => i.decisionBucket === 'doNow').map(buildActionItem),
    beforeChange: classifiedItems.filter(i => i.decisionBucket === 'beforeChange').map(buildActionItem),
    checkLater: classifiedItems.filter(i => i.decisionBucket === 'checkLater').map(buildActionItem),
    missingData: classifiedItems.filter(i => i.decisionBucket === 'missingData').map(buildActionItem),
  };

  const personalOverview = buildPersonalOverview(packages, classifiedItems, globalScore);
  const missingDataItems = classifiedItems.filter(i => i.classification === 'missingData');

  return {
    personalOverview,
    currentPosition: buildCurrentPosition(packages),
    mainDecisions,
    managementFees: buildManagementFeeSection(packages),
    insuranceSummary: buildInsuranceSummary(packages),
    payslipFindings: buildPayslipFindingsSection(packages),
    productAlternatives: buildProductAlternatives(packages),
    actionPlan,
    allRecommendations,
    userSummary: buildUserSummary(personalOverview, mainDecisions, missingDataItems),
    conflicts: conflicts || [],
    stats: {
      totalRecommendations: classifiedItems.length,
      mainDecisionCount: mainDecisions.length,
      missingDataCount: missingDataItems.length,
      notMaterialCount: classifiedItems.filter(i => i.classification === 'notMaterial').length,
    },
  };
}

module.exports = {
  runReportCoordinator,
  isMissingDataItem,
  isMaterial,
  classifyItem,
  buildMonetaryImpact,
  buildDecisionCard,
  buildManagementFeeSection,
  annualizeSavings,
  MISSING_DATA_PATTERNS,
};
