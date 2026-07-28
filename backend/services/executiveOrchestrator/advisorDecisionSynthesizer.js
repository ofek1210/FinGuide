'use strict';

/**
 * Advisor-style presentation synthesizer.
 * Picks ONE clear decision per domain from existing agent outputs — no new math.
 */

const { MATERIALITY_ANNUAL_NIS } = require('../../config/executiveReportConfig');
const { annualizeSavings } = require('./reportCoordinator');

const VERDICT = {
  RECOMMEND: 'recommend',
  KEEP: 'keep',
  CONSIDER_REPLACE: 'consider_replace',
  INSUFFICIENT: 'insufficient_confidence',
  NO_ACTION: 'no_action',
};

const PRIORITY_HE = { high: 'גבוהה', medium: 'בינונית', low: 'נמוכה' };

function formatIls(amount) {
  if (amount == null || !Number.isFinite(Number(amount))) return null;
  return `₪${Math.round(Number(amount)).toLocaleString('he-IL')}`;
}

function pickTopPrimary(primaryRecs = []) {
  if (!primaryRecs.length) return null;
  return [...primaryRecs].sort((a, b) => {
    const scoreA = a.portfolioSelection?.priorityScore
      ?? a.financialImpact?.amount
      ?? 0;
    const scoreB = b.portfolioSelection?.priorityScore
      ?? b.financialImpact?.amount
      ?? 0;
    return scoreB - scoreA;
  })[0];
}

function confidenceIsInsufficient(confidence) {
  return confidence === 'insufficient_data' || confidence === 'low';
}

function baseDecision(agentId, overrides = {}) {
  return {
    agentId,
    kind: agentId,
    verdict: VERDICT.NO_ACTION,
    verdictLabelHe: 'אין פעולה נדרשת כרגע',
    recommendedProduct: null,
    whySelected: null,
    expectedBenefit: null,
    annualSavings: null,
    nextAction: null,
    comparison: null,
    bullets: null,
    confidence: null,
    actionable: false,
    ...overrides,
  };
}

/**
 * Pension: one recommended fund/track, or explicit insufficient-confidence.
 */
function buildPensionDecision(pkg) {
  if (!pkg || pkg.status !== 'success') {
    return baseDecision('pension', {
      verdict: VERDICT.NO_ACTION,
      verdictLabelHe: 'אין נתוני פנסיה לניתוח',
    });
  }

  const primary = pickTopPrimary(pkg.primaryRecommendations || []);
  const fundAdvice = pkg.rawDataSummary?.fundAdvice;
  const savings = primary?.financialImpact?.amount
    ?? (primary ? annualizeSavings({
      possibleSavings: primary.financialImpact?.amount,
      title: primary.title,
      explanation: primary.explanation,
    }) : null);

  if (primary && confidenceIsInsufficient(primary.confidence) && !(savings >= MATERIALITY_ANNUAL_NIS)) {
    return baseDecision('pension', {
      verdict: VERDICT.INSUFFICIENT,
      verdictLabelHe: 'אין מספיק ביטחון להמליץ על מעבר',
      whySelected: primary.whyItMatters || primary.explanation || 'חסרים נתונים להשוואה מהימנה מול השוק.',
      expectedBenefit: null,
      nextAction: 'השלימו נתונים או דוח מסלקה עדכני לפני החלטת מעבר.',
      confidence: primary.confidence || 'insufficient_data',
      actionable: false,
    });
  }

  const alt = primary?.evidence?.alternatives?.[0] || primary?.alternatives?.[0] || null;
  if (alt) {
    const reasons = (alt.reasons || []).slice(0, 2).join(' · ');
    return baseDecision('pension', {
      verdict: VERDICT.RECOMMEND,
      verdictLabelHe: 'מוצר מומלץ להשוואה',
      recommendedProduct: {
        name: alt.fundName || alt.productName || null,
        provider: alt.managingCompany || alt.companyName || null,
        track: alt.trackName || null,
      },
      whySelected: reasons
        || primary.whyItMatters
        || primary.explanation
        || 'נבחר כחלופה החזקה ביותר מהשוואה הקיימת.',
      expectedBenefit: primary.nextStep
        || (savings != null ? `חיסכון שנתי מוערך: ${formatIls(savings)}` : null),
      annualSavings: Number.isFinite(Number(savings)) ? Number(savings) : null,
      nextAction: primary.nextStep || 'פנו לסוכן/גוף הפנסיה לבדיקת מעבר או הורדת דמי ניהול.',
      confidence: primary.confidence || 'medium',
      actionable: true,
    });
  }

  // Legacy fundAdvice path
  const funds = fundAdvice?.funds || [];
  const switchable = funds
    .filter(f => f.verdict === 'SWITCH' || f.verdict === 'NEGOTIATE')
    .sort((a, b) => (b.gainIfSwitch || 0) - (a.gainIfSwitch || 0));

  if (switchable[0]) {
    const f = switchable[0];
    const isNegotiate = f.verdict === 'NEGOTIATE';
    return baseDecision('pension', {
      verdict: VERDICT.RECOMMEND,
      verdictLabelHe: isNegotiate ? 'מומלץ לנהל משא ומתן על דמי ניהול' : 'מומלץ לבחון מעבר',
      recommendedProduct: {
        name: f.fundName || null,
        provider: null,
        track: null,
      },
      whySelected: f.verdictLabelHe || fundAdvice.overallVerdictLabelHe || 'מבוסס על השוואת שוק.',
      expectedBenefit: f.gainIfSwitch != null
        ? `תועלת מוערכת: ${formatIls(f.gainIfSwitch)} בשנה`
        : null,
      annualSavings: f.gainIfSwitch ?? null,
      nextAction: isNegotiate
        ? 'פנו לגוף הפנסיה ובקשו הורדת דמי ניהול.'
        : 'בחנו מעבר לקרן/מסלול תחרותי יותר מול בעל רישיון.',
      confidence: 'medium',
      actionable: true,
    });
  }

  if (fundAdvice?.overallVerdict === 'LEAVE' || primary) {
    return baseDecision('pension', {
      verdict: VERDICT.KEEP,
      verdictLabelHe: 'להישאר במסלול הנוכחי',
      whySelected: fundAdvice?.overallVerdictLabelHe
        || primary?.whyItMatters
        || 'לא נמצאה חלופה מהותית יותר כרגע.',
      expectedBenefit: primary?.nextStep || null,
      nextAction: primary?.nextStep || 'אין צורך בפעולה כרגע — עקבו אחרי דמי ניהול מדי שנה.',
      confidence: primary?.confidence || 'medium',
      actionable: false,
    });
  }

  // Fallback: top normalized recommendation
  const topRec = (pkg.recommendations || []).find(r => r.itemKind !== 'missing_data');
  if (topRec) {
    return baseDecision('pension', {
      verdict: VERDICT.RECOMMEND,
      verdictLabelHe: 'המלצה מרכזית',
      whySelected: topRec.whyItMatters || topRec.explanation,
      expectedBenefit: topRec.expectedBenefit,
      annualSavings: topRec.possibleSavings ?? null,
      nextAction: topRec.expectedBenefit || topRec.title,
      confidence: topRec.confidence >= 0.8 ? 'high' : 'medium',
      actionable: true,
    });
  }

  return baseDecision('pension', {
    verdict: VERDICT.NO_ACTION,
    verdictLabelHe: 'אין המלצה מהותית לשינוי',
  });
}

/**
 * Gemel: single strongest alternative with fees / performance / risk comparison.
 */
function buildGemelDecision(pkg) {
  if (!pkg || pkg.status !== 'success') {
    return baseDecision('gemel', {
      verdict: VERDICT.NO_ACTION,
      verdictLabelHe: 'אין נתוני גמל לניתוח',
    });
  }

  const primary = pickTopPrimary(pkg.primaryRecommendations || []);
  if (primary && confidenceIsInsufficient(primary.confidence)) {
    const savings = primary.financialImpact?.amount;
    if (!(savings >= MATERIALITY_ANNUAL_NIS)) {
      return baseDecision('gemel', {
        verdict: VERDICT.INSUFFICIENT,
        verdictLabelHe: 'אין מספיק ביטחון להמליץ על מעבר',
        whySelected: primary.whyItMatters || primary.explanation || 'חסרים נתונים להשוואה מהימנה.',
        nextAction: 'השלימו דוח מסלקה עדכני לפני החלטת מעבר.',
        confidence: primary.confidence,
        actionable: false,
      });
    }
  }

  const marketFunds = (pkg.rawDataSummary?.marketAdvice?.funds || [])
    .filter(f => f.verdict && f.verdict !== 'LEAVE')
    .sort((a, b) => (b.annualSavingsEstimate || 0) - (a.annualSavingsEstimate || 0));

  const marketFund = marketFunds[0] || null;
  const marketAlt = marketFund?.alternatives?.[0] || null;

  // Advisor report: rank-1 alternative across accounts
  let advisorAlt = null;
  let advisorAccount = null;
  for (const account of (pkg.rawDataSummary?.advisorReport?.accounts || [])) {
    const ranked = [...(account.alternatives || [])].sort((a, b) => (a.rank || 99) - (b.rank || 99));
    if (ranked[0] && (!advisorAlt || (ranked[0].rank || 99) < (advisorAlt.rank || 99))) {
      advisorAlt = ranked[0];
      advisorAccount = account;
    }
  }

  const primaryAlt = primary?.evidence?.alternatives?.[0] || primary?.alternatives?.[0] || null;
  const bestAlt = marketAlt || advisorAlt || primaryAlt;

  if (bestAlt || marketFund) {
    const name = bestAlt?.fundName || bestAlt?.productName || marketFund?.productName || null;
    const provider = bestAlt?.companyName || bestAlt?.managingCompany || marketFund?.companyName || null;
    const annual = marketFund?.annualSavingsEstimate
      ?? advisorAccount?.possibleSavings
      ?? primary?.financialImpact?.amount
      ?? null;

    const fees = {
      current: marketFund?.userFee ?? advisorAccount?.fees?.balancePct ?? primary?.evidence?.currentFeeBalancePct ?? null,
      alternative: bestAlt?.managementFeeBalanceAvgPct
        ?? bestAlt?.managementFeeBalance
        ?? marketFund?.marketFee
        ?? primary?.evidence?.marketAverageFeeBalancePct
        ?? null,
      labelHe: 'דמי ניהול',
    };
    const performance = {
      current: marketFund?.userReturn5Y ?? advisorAccount?.returns?.return5YearsAnnualizedPct ?? null,
      alternative: bestAlt?.return5YearsAnnualizedPct ?? bestAlt?.return5Years ?? marketFund?.marketReturn5Y ?? null,
      labelHe: 'תשואה (5 שנים)',
    };
    const risk = {
      current: advisorAccount?.risk?.level || marketFund?.riskNote || null,
      alternative: bestAlt?.suitabilityScore != null
        ? `התאמה ${bestAlt.suitabilityScore}`
        : (bestAlt?.tradeoffs?.[0] || null),
      labelHe: 'סיכון / התאמה',
    };

    const why = (bestAlt?.reasons || []).slice(0, 2).join(' · ')
      || marketFund?.summaryHe
      || primary?.whyItMatters
      || 'נבחר כחלופה החזקה ביותר לפי דמי ניהול, תשואה והתאמה.';

    return baseDecision('gemel', {
      verdict: VERDICT.RECOMMEND,
      verdictLabelHe: 'חלופה מומלצת',
      recommendedProduct: { name, provider, track: null },
      whySelected: why,
      expectedBenefit: annual != null
        ? `חיסכון שנתי מוערך: ${formatIls(annual)}`
        : (primary?.nextStep || null),
      annualSavings: annual != null ? Number(annual) : null,
      nextAction: primary?.nextStep
        || 'השוו מול בעל רישיון את המעבר לחלופה המומלצת.',
      comparison: { fees, performance, risk },
      confidence: primary?.confidence || 'medium',
      actionable: true,
    });
  }

  if (pkg.rawDataSummary?.marketAdvice?.overallVerdict === 'LEAVE' || primary) {
    return baseDecision('gemel', {
      verdict: VERDICT.KEEP,
      verdictLabelHe: 'להישאר במוצר הנוכחי',
      whySelected: pkg.rawDataSummary?.marketAdvice?.overallVerdictLabelHe
        || primary?.whyItMatters
        || 'לא נמצאה חלופה מהותית יותר כרגע.',
      nextAction: primary?.nextStep || 'עקבו אחרי דמי ניהול ותשואות מדי שנה.',
      confidence: primary?.confidence || 'medium',
      actionable: false,
    });
  }

  const topRec = (pkg.recommendations || []).find(r => r.itemKind !== 'missing_data');
  if (topRec) {
    return baseDecision('gemel', {
      verdict: VERDICT.RECOMMEND,
      verdictLabelHe: 'המלצה מרכזית',
      whySelected: topRec.whyItMatters || topRec.explanation,
      expectedBenefit: topRec.expectedBenefit,
      annualSavings: topRec.possibleSavings ?? null,
      nextAction: topRec.expectedBenefit || topRec.title,
      actionable: true,
    });
  }

  return baseDecision('gemel', {
    verdict: VERDICT.NO_ACTION,
    verdictLabelHe: 'אין המלצה מהותית לשינוי',
  });
}

/**
 * Insurance: keep vs consider replacing + 3–5 concise bullets.
 */
function buildInsuranceDecision(pkg) {
  if (!pkg || pkg.status !== 'success') {
    return baseDecision('insurance', {
      verdict: VERDICT.NO_ACTION,
      verdictLabelHe: 'אין נתוני ביטוח לניתוח',
    });
  }

  const data = pkg.rawDataSummary || {};
  const overall = data.marketAdvice?.overallVerdict || null;
  const bullets = [];

  if (data.duplicateCount > 0) {
    bullets.push(`זוהו ${data.duplicateCount} ממצאי כפילות או חפיפה אפשריים לבדיקה.`);
  }
  if (data.totalMonthlyWaste > 0) {
    bullets.push(`פרמיה חודשית לבדיקה: ${formatIls(data.totalMonthlyWaste)}.`);
  }
  const missing = data.missingCoverage || [];
  if (missing.length) {
    const labels = missing.slice(0, 3).map(m => (typeof m === 'string' ? m : m.title || m.type || m.area)).filter(Boolean);
    if (labels.length) bullets.push(`כיסויים חסרים שזוהו: ${labels.join(', ')}.`);
  }
  if (data.hasCriticalGap) {
    bullets.push('קיים פער כיסוי קריטי שמומלץ לטפל בו בהקדם.');
  }

  for (const row of (data.marketAdvice?.comparisonMatrix || []).slice(0, 2)) {
    if (row.comparisonNoteHe) bullets.push(row.comparisonNoteHe);
    else if (row.premiumVsMarket === 'high' || row.verdict === 'SWITCH' || row.verdict === 'REVIEW') {
      bullets.push(`${row.displayName || row.policyType || 'פוליסה'}: עלות מעל ממוצע השוק — ${row.verdictLabelHe || row.verdict || 'לבדיקה'}.`);
    }
  }

  for (const rec of (pkg.recommendations || []).slice(0, 3)) {
    if (rec.itemKind === 'missing_data') continue;
    const line = rec.reason || rec.explanation || rec.title;
    if (line && !bullets.includes(line)) bullets.push(line.length > 120 ? `${line.slice(0, 117)}…` : line);
  }

  const trimmed = bullets.slice(0, 5);
  const isKeep = overall === 'STAY' || (!overall && trimmed.length === 0 && !(data.duplicateCount > 0) && !missing.length);
  const isReplace = overall === 'SWITCH' || overall === 'REVIEW'
    || data.duplicateCount > 0
    || missing.length > 0
    || data.hasCriticalGap
    || (pkg.recommendations || []).some(r => r.itemKind !== 'missing_data');

  if (isKeep && !isReplace) {
    return baseDecision('insurance', {
      verdict: VERDICT.KEEP,
      verdictLabelHe: 'להשאיר את הפוליסות הנוכחיות',
      bullets: trimmed.length ? trimmed : ['לא זוהו כפילויות או פערים מהותיים כרגע.'],
      whySelected: data.marketAdvice?.overallVerdictLabelHe || 'הכיסוי הנוכחי סביר ביחס לשוק.',
      nextAction: 'עקבו אחרי חידושים ופרמיות מדי שנה.',
      confidence: 'medium',
      actionable: false,
    });
  }

  const annual = data.totalMonthlyWaste > 0 ? data.totalMonthlyWaste * 12 : null;
  const topRec = (pkg.recommendations || []).find(r => r.itemKind !== 'missing_data');

  return baseDecision('insurance', {
    verdict: VERDICT.CONSIDER_REPLACE,
    verdictLabelHe: overall === 'SWITCH' ? 'לשקול החלפת כיסוי' : 'לשקול בדיקה מחדש של הכיסוי',
    bullets: trimmed.length
      ? trimmed
      : ['מומלץ לבחון מחדש את הפוליסות מול צרכים ועלות.'],
    whySelected: data.marketAdvice?.overallVerdictLabelHe
      || topRec?.whyItMatters
      || 'נמצאו ממצאים שמצדיקים בדיקה.',
    expectedBenefit: annual != null
      ? `פוטנציאל חיסכון שנתי מוערך: ${formatIls(annual)}`
      : (topRec?.expectedBenefit || null),
    annualSavings: annual,
    nextAction: topRec?.expectedBenefit
      || 'עברו על הכפילויות והפערים ופנו לסוכן ביטוח לבדיקה.',
    confidence: 'medium',
    actionable: true,
  });
}

/**
 * Payslip: brief top material finding or no-action.
 */
function buildPayslipDecision(pkg) {
  if (!pkg || pkg.status !== 'success') {
    return baseDecision('payslip', {
      verdict: VERDICT.NO_ACTION,
      verdictLabelHe: 'אין תלושי שכר לניתוח',
    });
  }

  const topRec = (pkg.recommendations || []).find(r => r.itemKind !== 'missing_data');
  const topFinding = (pkg.findings || []).find(f => f.kind !== 'strength' && f.severity !== 'info');

  if (topRec) {
    return baseDecision('payslip', {
      verdict: VERDICT.RECOMMEND,
      verdictLabelHe: 'ממצא מרכזי בתלוש',
      whySelected: topRec.whyItMatters || topRec.explanation,
      expectedBenefit: topRec.expectedBenefit,
      annualSavings: topRec.possibleSavings ?? null,
      nextAction: topRec.expectedBenefit || topRec.title,
      confidence: topRec.confidence >= 0.8 ? 'high' : 'medium',
      actionable: true,
    });
  }

  if (topFinding) {
    return baseDecision('payslip', {
      verdict: VERDICT.RECOMMEND,
      verdictLabelHe: 'ממצא לבדיקה',
      whySelected: topFinding.explanation || topFinding.title,
      nextAction: topFinding.title,
      actionable: true,
    });
  }

  return baseDecision('payslip', {
    verdict: VERDICT.KEEP,
    verdictLabelHe: 'אין חריגות מהותיות בתלוש',
    whySelected: 'התלושים נבדקו ולא נמצאו ממצאים שדורשים פעולה כרגע.',
    actionable: false,
  });
}

function buildDomainDecision(agentId, pkg) {
  switch (agentId) {
    case 'pension': return buildPensionDecision(pkg);
    case 'gemel': return buildGemelDecision(pkg);
    case 'insurance': return buildInsuranceDecision(pkg);
    case 'payslip': return buildPayslipDecision(pkg);
    default: return baseDecision(agentId);
  }
}

function priorityFromDecision(decision, scoredItem) {
  const annual = decision.annualSavings
    ?? (scoredItem ? annualizeSavings(scoredItem) : null)
    ?? 0;
  const severity = scoredItem?.severity;
  if (severity === 'critical' || severity === 'high' || annual >= 1000) return 'high';
  if (severity === 'medium' || annual >= MATERIALITY_ANNUAL_NIS) return 'medium';
  return 'low';
}

function normalizeTitleKey(title) {
  return String(title || '')
    .toLowerCase()
    .replace(/[^\u0590-\u05FFa-z0-9]+/gi, '')
    .slice(0, 80);
}

/**
 * Prioritized action plan from domain decisions (deduped, impact-sorted).
 */
function buildActionPlan({ domainDecisions = [], scoredItems = [] } = {}) {
  const seen = new Set();
  const actions = [];

  for (const decision of domainDecisions) {
    if (!decision?.actionable) continue;
    const actionText = decision.nextAction || decision.expectedBenefit || decision.verdictLabelHe;
    if (!actionText) continue;

    const key = normalizeTitleKey(`${decision.agentId}-${actionText}`);
    if (seen.has(key)) continue;
    seen.add(key);

    const scored = (scoredItems || []).find(s =>
      (s.sourceAgents || []).includes(decision.agentId)
      || normalizeTitleKey(s.title) === normalizeTitleKey(decision.recommendedProduct?.name)
      || (decision.whySelected && String(s.title || '').includes(String(decision.whySelected).slice(0, 20))),
    );

    const annual = decision.annualSavings
      ?? (scored ? annualizeSavings(scored) : null);

    actions.push({
      priority: priorityFromDecision(decision, scored),
      priorityLabelHe: null,
      action: actionText,
      expectedBenefit: decision.expectedBenefit || null,
      estimatedAnnualSavings: annual != null && Number.isFinite(Number(annual)) ? Number(annual) : null,
      reason: decision.whySelected || decision.verdictLabelHe,
      agentId: decision.agentId,
    });
  }

  // Fill any high-impact scored items not already covered by a domain decision
  for (const item of scoredItems || []) {
    if (item.itemKind === 'missing_data') continue;
    const annual = annualizeSavings(item);
    if (annual != null && annual < MATERIALITY_ANNUAL_NIS && item.severity !== 'critical' && item.severity !== 'high') {
      continue;
    }
    const key = normalizeTitleKey(`${(item.sourceAgents || [])[0] || 'x'}-${item.title}`);
    if (seen.has(key)) continue;
    // Skip if a domain decision for this agent already covers it
    const agentId = (item.sourceAgents || []).find(a => ['pension', 'gemel', 'insurance', 'payslip'].includes(a));
    if (agentId && actions.some(a => a.agentId === agentId)) continue;
    if (!agentId) continue;

    seen.add(key);
    const priority = priorityFromDecision(
      { annualSavings: annual, actionable: true },
      item,
    );
    actions.push({
      priority,
      priorityLabelHe: null,
      action: item.expectedBenefit || item.title,
      expectedBenefit: item.expectedBenefit || null,
      estimatedAnnualSavings: annual,
      reason: item.whyItMatters || item.explanation || item.title,
      agentId,
    });
  }

  const rank = { high: 0, medium: 1, low: 2 };
  actions.sort((a, b) => {
    const savA = a.estimatedAnnualSavings ?? 0;
    const savB = b.estimatedAnnualSavings ?? 0;
    if (savB !== savA) return savB - savA;
    return (rank[a.priority] ?? 9) - (rank[b.priority] ?? 9);
  });

  return actions.map(a => ({
    ...a,
    priorityLabelHe: PRIORITY_HE[a.priority] || a.priority,
  }));
}

/**
 * Mirror a bestDecision as a single preserved recommendation for backward compat.
 */
function decisionToRecommendation(decision) {
  if (!decision || !decision.actionable && decision.verdict === VERDICT.NO_ACTION) return null;
  if (decision.verdict === VERDICT.NO_ACTION && !decision.whySelected) return null;

  const product = decision.recommendedProduct;
  const title = product?.name
    ? `${decision.verdictLabelHe}: ${product.name}`
    : decision.verdictLabelHe;

  return {
    agentId: decision.agentId,
    recommendationId: `best-${decision.agentId}`,
    title,
    description: decision.whySelected || decision.verdictLabelHe,
    reason: decision.whySelected,
    expectedBenefit: decision.nextAction || decision.expectedBenefit,
    source: null,
    confidence: typeof decision.confidence === 'number'
      ? decision.confidence
      : (decision.confidence === 'high' ? 0.9 : decision.confidence === 'low' || decision.confidence === 'insufficient_data' ? 0.4 : 0.7),
  };
}

function synthesizeAdvisorReport(packages, { scoredItems = null } = {}) {
  const agentIds = ['pension', 'gemel', 'insurance', 'payslip'];
  const domainDecisions = agentIds.map(id => buildDomainDecision(id, packages?.[id]));
  const decisionByAgent = Object.fromEntries(domainDecisions.map(d => [d.agentId, d]));
  const actionPlan = buildActionPlan({ domainDecisions, scoredItems: scoredItems || [] });

  return { domainDecisions, decisionByAgent, actionPlan };
}

module.exports = {
  VERDICT,
  buildPensionDecision,
  buildGemelDecision,
  buildInsuranceDecision,
  buildPayslipDecision,
  buildDomainDecision,
  buildActionPlan,
  decisionToRecommendation,
  synthesizeAdvisorReport,
  pickTopPrimary,
};
