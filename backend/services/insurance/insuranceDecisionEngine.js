'use strict';

/**
 * Insurance Decision Engine — deterministic portfolio health decision.
 * No LLM. Inputs: policies, onboarding/profile, service index, gap/duplicate engines.
 */

const STATUS = {
  HEALTHY: 'healthy',
  NEEDS_REVIEW: 'needs_review',
  ACTION_REQUIRED: 'action_required',
};

const STATUS_META = {
  healthy: {
    labelHe: 'תקין',
    badgeTone: 'green',
    summaryHe: 'התיק הביטוחי נראה תקין יחסית לפי הנתונים הזמינים.',
  },
  needs_review: {
    labelHe: 'דורש בדיקה',
    badgeTone: 'yellow',
    summaryHe: 'יש נקודות לבדיקה — כפילויות אפשריות, מידע חסר או התאמה לפרופיל.',
  },
  action_required: {
    labelHe: 'נדרשת פעולה',
    badgeTone: 'red',
    summaryHe: 'זוהו ממצאים שדורשים טיפול: פער כיסוי, כפילות או מדד שירות נמוך.',
  },
};

const SCORE_BANDS = [
  { min: 90, code: 'excellent', labelHe: 'מצוין', labelEn: 'Very Good' },
  { min: 75, code: 'good', labelHe: 'טוב', labelEn: 'Good' },
  { min: 60, code: 'fair', labelHe: 'בינוני', labelEn: 'Fair' },
  { min: 0, code: 'poor', labelHe: 'דורש שיפור', labelEn: 'Needs Improvement' },
];

const PRIORITY = {
  high: { rank: 1, labelHe: 'גבוהה' },
  medium: { rank: 2, labelHe: 'בינונית' },
  low: { rank: 3, labelHe: 'נמוכה' },
};

const TYPE_LABELS = {
  life: 'ביטוח חיים',
  health: 'ביטוח בריאות',
  health_supplement: 'ביטוח בריאות משלים',
  disability: 'אובדן כושר עבודה',
  apartment: 'ביטוח דירה',
  car: 'ביטוח רכב',
  mortgage: 'ביטוח משכנתא',
  critical_illness: 'מחלות קשות',
  travel: 'ביטוח נסיעות',
  contents: 'ביטוח תכולה',
  other: 'אחר',
};

function scoreBand(score) {
  return SCORE_BANDS.find(b => score >= b.min) || SCORE_BANDS[SCORE_BANDS.length - 1];
}

/**
 * Per-policy coverage completeness checklist + confidence.
 */
function computeCoverageCompleteness(policy) {
  const raw = policy.rawData || {};
  const checks = [];

  const push = (id, labelHe, ok, unknown = false) => {
    checks.push({
      id,
      labelHe,
      status: unknown ? 'unknown' : ok ? 'ok' : 'missing',
    });
  };

  push('policy_identified', 'פוליסה זוהתה', Boolean(policy.type || policy.id));
  push('insurer', 'חברת ביטוח זוהתה', Boolean(policy.provider));
  push('active', 'סטטוס פעיל', policy.status === 'active' || !policy.status);
  push('policy_number', 'מספר פוליסה', Boolean(policy.policyNumber));
  push('coverage_amount', 'סכום כיסוי', policy.coverageAmount != null);
  push('dates', 'תאריכי תוקף', Boolean(policy.startDate || policy.endDate));

  if (policy.type === 'health' || policy.type === 'health_supplement') {
    const hasSub = Boolean(raw.subBranch || raw.productType || raw.coverageScope);
    push('coverage_scope', 'היקף כיסוי', hasSub, !hasSub);
    push('deductible', 'השתתפות עצמית', raw.deductible != null, raw.deductible == null);
    const overseas = /חו.?ל|overseas|abroad/i.test(String(raw.subBranch || raw.productName || ''));
    push('overseas_surgery', 'ניתוחים בחו״ל', overseas, !overseas && !hasSub);
  }

  if (policy.type === 'life') {
    push('benefit_amount', 'סכום ביטוח', policy.coverageAmount != null);
  }

  const known = checks.filter(c => c.status !== 'unknown');
  const okCount = known.filter(c => c.status === 'ok').length;
  const missingCount = checks.filter(c => c.status === 'missing').length;
  const unknownCount = checks.filter(c => c.status === 'unknown').length;
  const ratio = known.length ? okCount / known.length : 0;

  let confidence = 'low';
  if (ratio >= 0.85 && missingCount === 0) confidence = 'high';
  else if (ratio >= 0.55 || (okCount >= 3 && missingCount <= 1)) confidence = 'medium';

  const confidenceLabelHe = { high: 'גבוהה', medium: 'בינונית', low: 'נמוכה' }[confidence];

  return {
    policyId: policy.id,
    coverageType: policy.type,
    coverageTypeLabelHe: TYPE_LABELS[policy.type] || policy.type,
    provider: policy.provider || null,
    status: policy.status || 'active',
    checks,
    completenessScore: Math.round(ratio * 100),
    coverageConfidence: confidence,
    coverageConfidenceLabelHe: confidenceLabelHe,
    missingInformation: checks.filter(c => c.status === 'missing' || c.status === 'unknown').map(c => c.labelHe),
    // Unknown optional fields (e.g. deductible) do not alone force manual review.
    manualReviewRecommended: missingCount >= 2 || !policy.provider,
    unknownFieldCount: unknownCount,
  };
}

function collectSignals(analysis, marketAdvice, policies) {
  const duplicates = analysis.duplicateFindings || analysis.duplicates || [];
  const likelyDupes = duplicates.filter(d => d.status === 'likely_duplicate');
  const overlaps = duplicates.filter(d => d.status === 'possible_overlap' || d.status === 'insufficient_data');
  const missingNeeded = (analysis.gapFindings || []).filter(g => g.status === 'missing_needed');
  const missingOptional = (analysis.gapFindings || []).filter(g => g.status === 'missing_optional');
  const disabilityUnverified = (analysis.gapFindings || []).some(g => g.type === 'disability' && g.status === 'unverified_in_file');
  const poorService = (marketAdvice.comparisonMatrix || []).filter(
    r => r.serviceTier === 'poor' || (r.serviceScore != null && r.serviceScore < 70),
  );
  const fairService = (marketAdvice.comparisonMatrix || []).filter(r => r.serviceTier === 'fair');
  const inactive = (policies || []).filter(p => p.status === 'cancelled' || p.status === 'expired');
  const completeness = (policies || []).filter(p => p.status !== 'cancelled').map(computeCoverageCompleteness);
  const incomplete = completeness.filter(c => c.manualReviewRecommended);
  const notNeeded = (analysis.needAssessments || []).filter(
    a => a.status === 'not_recommended' || a.status === 'possibly_unnecessary',
  );
  const insufficientProfile = (analysis.needAssessments || []).filter(a => a.status === 'insufficient_profile');

  return {
    likelyDupes,
    overlaps,
    missingNeeded,
    missingOptional,
    disabilityUnverified,
    poorService,
    fairService,
    inactive,
    completeness,
    incomplete,
    notNeeded,
    insufficientProfile,
    vehicleVerificationNeeded: Boolean(analysis.vehicleVerificationNeeded),
    duplicateCount: analysis.duplicateCount || 0,
  };
}

function computeHealthScore(signals) {
  let score = 100;
  const explanations = [];

  const dupePenalty = Math.min(30, signals.likelyDupes.length * 15);
  if (dupePenalty) {
    score -= dupePenalty;
    explanations.push(
      signals.likelyDupes.length
        ? `זוהו ${signals.likelyDupes.length} כפילויות אפשריות לאימות.`
        : null,
    );
  }

  const overlapPenalty = Math.min(24, signals.overlaps.length * 8);
  if (overlapPenalty) {
    score -= overlapPenalty;
    explanations.push(`יש ${signals.overlaps.length} חפיפות כיסוי לבדיקה.`);
  }

  const gapPenalty = Math.min(36, signals.missingNeeded.length * 12);
  if (gapPenalty) {
    score -= gapPenalty;
    explanations.push(`חסרים ${signals.missingNeeded.length} כיסויים שנראים נחוצים לפי הפרופיל.`);
  }

  if (signals.disabilityUnverified) {
    score -= 8;
    explanations.push('כיסוי אובדן כושר עבודה לא זוהה בדוח — כדאי לאמת מול פנסיה/מעסיק.');
  }

  if (signals.poorService.length) {
    score -= Math.min(20, signals.poorService.length * 15);
    explanations.push('מדד שירות נמוך באחת או יותר מהחברות.');
  } else if (signals.fairService.length) {
    score -= Math.min(10, signals.fairService.length * 4);
  }

  const inactivePenalty = Math.min(9, signals.inactive.length * 3);
  if (inactivePenalty) {
    score -= inactivePenalty;
    explanations.push(`יש ${signals.inactive.length} פוליסות לא פעילות לבדיקה.`);
  }

  const incompletePenalty = Math.min(16, signals.incomplete.length * 4);
  if (incompletePenalty) {
    score -= incompletePenalty;
    explanations.push('חלק מהפוליסות חסרות פרטי כיסוי.');
  }

  if (signals.vehicleVerificationNeeded) {
    score -= 6;
    explanations.push('נדרש מספר רכבים כדי לאמת פוליסות רכב.');
  }

  if (signals.insufficientProfile.length) {
    score -= Math.min(9, signals.insufficientProfile.length * 3);
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  if (!explanations.filter(Boolean).length) {
    explanations.push('לא זוהו כפילויות מאומתות.');
    explanations.push('הכיסוי תואם באופן כללי לפרופיל הזמין.');
    if (signals.incomplete.length === 0) {
      explanations.push('פרטי הפוליסות שלמים יחסית.');
    } else {
      explanations.push('חסרים רק פרטים מינוריים.');
    }
  }

  const band = scoreBand(score);
  return {
    score,
    labelHe: band.labelHe,
    labelEn: band.labelEn,
    bandCode: band.code,
    explanationBullets: explanations.filter(Boolean).slice(0, 5),
  };
}

function decideOverallStatus(signals, health) {
  const hasAction = signals.likelyDupes.length > 0
    || signals.missingNeeded.some(g => g.confidence === 'high' || ['life', 'car', 'apartment'].includes(g.type))
    || signals.poorService.length > 0
    || health.score < 55;

  if (hasAction) return STATUS.ACTION_REQUIRED;

  const needsReview = signals.overlaps.length > 0
    || signals.missingNeeded.length > 0
    || signals.missingOptional.length > 0
    || signals.disabilityUnverified
    || signals.incomplete.length > 0
    || signals.vehicleVerificationNeeded
    || signals.fairService.length > 0
    || signals.inactive.length > 0
    || signals.insufficientProfile.length > 0
    || health.score < 75;

  if (needsReview) return STATUS.NEEDS_REVIEW;
  return STATUS.HEALTHY;
}

function buildExecutiveActions(signals, analysis) {
  const actions = [];

  const push = (action) => {
    if (actions.length >= 5) return;
    if (actions.some(a => a.id === action.id)) return;
    actions.push(action);
  };

  for (const d of signals.likelyDupes.slice(0, 2)) {
    push({
      id: `dup_${d.type || d.coverageFamily}`,
      priority: 'high',
      priorityLabelHe: PRIORITY.high.labelHe,
      titleHe: `אימות כפילות — ${d.typeLabelHe || TYPE_LABELS[d.type] || d.type || 'כיסוי'}`,
      reasonHe: d.reasonHe || 'זוהו פוליסות דומות שעלולות להיות כפולות.',
      expectedBenefitHe: 'הבהרת הכיסוי ומניעת תשלום כפול על אותו סיכון.',
      evidence: {
        kind: 'duplicate',
        status: d.status,
        policyCount: d.policyCount || d.policies?.length || null,
        premiumUnderReviewMonthly: d.premiumUnderReviewMonthly ?? null,
      },
    });
  }

  for (const d of signals.overlaps.slice(0, 2)) {
    push({
      id: `overlap_${d.type || d.coverageFamily}`,
      priority: 'medium',
      priorityLabelHe: PRIORITY.medium.labelHe,
      titleHe: `בדיקת חפיפה — ${d.typeLabelHe || TYPE_LABELS[d.type] || d.type || 'כיסוי'}`,
      reasonHe: d.reasonHe || 'קיימת חפיפה אפשרית בין כיסויים.',
      expectedBenefitHe: 'ודאות לגבי היקף הכיסוי בפועל.',
      evidence: { kind: 'overlap', status: d.status },
    });
  }

  if (signals.vehicleVerificationNeeded) {
    push({
      id: 'verify_vehicles',
      priority: 'medium',
      priorityLabelHe: PRIORITY.medium.labelHe,
      titleHe: 'עדכון מספר רכבים בפרופיל',
      reasonHe: 'מספר חבילות רכב בדוח דורש אימות מול מספר הרכבים שבבעלותך.',
      expectedBenefitHe: 'הבחנה בין כפילות אמיתית לבין רכבים שונים.',
      evidence: { kind: 'onboarding_mismatch', field: 'vehiclesOwned' },
    });
  }

  for (const g of signals.missingNeeded) {
    push({
      id: `gap_${g.type}`,
      priority: g.confidence === 'high' ? 'high' : 'medium',
      priorityLabelHe: (g.confidence === 'high' ? PRIORITY.high : PRIORITY.medium).labelHe,
      titleHe: `אימות צורך — ${TYPE_LABELS[g.type] || g.type}`,
      reasonHe: g.messageHe,
      expectedBenefitHe: g.whyItMatters || 'השלמת כיסוי שמתאים לפרופיל.',
      evidence: { kind: 'coverage_gap', type: g.type, confidence: g.confidence || null },
    });
  }

  if (signals.disabilityUnverified) {
    push({
      id: 'disability_review',
      priority: 'medium',
      priorityLabelHe: PRIORITY.medium.labelHe,
      titleHe: 'בדיקת כיסוי אובדן כושר עבודה',
      reasonHe: 'לא זוהה אכ״ע בדוח הביטוח — ייתכן שקיים בפנסיה או אצל המעסיק.',
      expectedBenefitHe: 'מניעת רכישה כפולה אם הכיסוי כבר קיים במקום אחר.',
      evidence: {
        kind: 'disability_check',
        sources: analysis.disabilityCheckedSources || null,
      },
    });
  }

  for (const row of signals.poorService.slice(0, 1)) {
    push({
      id: `service_${row.provider || row.policyId}`,
      priority: 'medium',
      priorityLabelHe: PRIORITY.medium.labelHe,
      titleHe: `בחינת חברה — ${row.provider || row.type}`,
      reasonHe: `מדד שירות ${row.serviceScore}/100`
        + (row.claimPaymentRate != null ? `, תשלום תביעות ~${row.claimPaymentRate}%` : '')
        + ' — אינדיקציה אובייקטיבית (לא מחיר).',
      expectedBenefitHe: 'שירות ותביעות טובים יותר לפי מדד ממשלתי.',
      evidence: {
        kind: 'service_quality',
        serviceScore: row.serviceScore,
        claimPaymentRate: row.claimPaymentRate ?? null,
        satisfactionScore: row.satisfactionScore ?? null,
      },
    });
  }

  for (const c of signals.incomplete.slice(0, 2)) {
    push({
      id: `complete_${c.policyId}`,
      priority: 'low',
      priorityLabelHe: PRIORITY.low.labelHe,
      titleHe: `השלמת פרטי כיסוי — ${c.coverageTypeLabelHe}`,
      reasonHe: `חסרים: ${(c.missingInformation || []).slice(0, 3).join(', ') || 'פרטים'}`,
      expectedBenefitHe: 'ביטחון גבוה יותר בהבנת הכיסוי.',
      evidence: { kind: 'incomplete_coverage', policyId: c.policyId, confidence: c.coverageConfidence },
    });
  }

  for (const a of signals.notNeeded.filter(x => x.status === 'possibly_unnecessary').slice(0, 1)) {
    push({
      id: `unnecessary_${a.type}`,
      priority: 'low',
      priorityLabelHe: PRIORITY.low.labelHe,
      titleHe: a.titleHe,
      reasonHe: a.messageHe,
      expectedBenefitHe: 'התאמת התיק לצורך האמיתי לפי הפרופיל.',
      evidence: { kind: 'profile_mismatch', type: a.type, status: a.status },
    });
  }

  if (signals.inactive.length) {
    push({
      id: 'inactive_policies',
      priority: 'low',
      priorityLabelHe: PRIORITY.low.labelHe,
      titleHe: 'סקירת פוליסות לא פעילות',
      reasonHe: `נמצאו ${signals.inactive.length} פוליסות מבוטלות/פגות.`,
      expectedBenefitHe: 'ניקוי התיק ומניעת בלבול בחידושים.',
      evidence: { kind: 'inactive', count: signals.inactive.length },
    });
  }

  if (signals.insufficientProfile.length) {
    push({
      id: 'update_onboarding',
      priority: 'low',
      priorityLabelHe: PRIORITY.low.labelHe,
      titleHe: 'השלמת פרטי פרופיל',
      reasonHe: 'חסר מידע בפרופיל כדי לקבוע צורך בכיסויים מסוימים.',
      expectedBenefitHe: 'המלצות מדויקות יותר בפעם הבאה.',
      evidence: { kind: 'onboarding_incomplete', fields: signals.insufficientProfile.map(a => a.type) },
    });
  }

  actions.sort((a, b) => (PRIORITY[a.priority]?.rank || 9) - (PRIORITY[b.priority]?.rank || 9));
  return actions.slice(0, 5);
}

function buildCompanyQualityView(marketAdvice) {
  const matrix = (marketAdvice.comparisonMatrix || []).map(row => ({
    policyId: row.policyId,
    type: row.type,
    provider: row.provider,
    serviceScore: row.serviceScore ?? null,
    claimPaymentRate: row.claimPaymentRate ?? null,
    satisfactionScore: row.satisfactionScore ?? null,
    serviceTier: row.serviceTier || 'unknown',
    complaintIndicators: row.complaintIndicators ?? null,
    complaintIndicatorsLabelHe: row.complaintIndicators == null
      ? 'לא זמין במקור'
      : String(row.complaintIndicators),
    verdict: row.verdict || null,
  }));

  return {
    averageServiceIndex: marketAdvice.companyQuality?.averageServiceIndex ?? null,
    averageServiceTier: marketAdvice.companyQuality?.averageServiceTier ?? null,
    source: marketAdvice.companyQuality?.source || marketAdvice.dataSource || null,
    insurers: matrix,
  };
}

function buildQuickAnswers(signals, status, health) {
  return {
    portfolioHealth: {
      status,
      labelHe: STATUS_META[status].labelHe,
      score: health.score,
      scoreLabelHe: health.labelHe,
    },
    hasDuplicates: {
      value: signals.duplicateCount > 0 || signals.likelyDupes.length > 0 || signals.overlaps.length > 0,
      labelHe: signals.likelyDupes.length
        ? `כן — ${signals.likelyDupes.length} לבדיקה`
        : signals.overlaps.length
          ? `חפיפות אפשריות — ${signals.overlaps.length}`
          : 'לא זוהו כפילויות מאומתות',
      tone: signals.likelyDupes.length ? 'red' : signals.overlaps.length ? 'yellow' : 'green',
    },
    missingImportant: {
      value: signals.missingNeeded.length > 0,
      labelHe: signals.missingNeeded.length
        ? `כן — ${signals.missingNeeded.map(g => TYPE_LABELS[g.type] || g.type).join(', ')}`
        : 'לא זוהו פערי כיסוי מהותיים לפי הפרופיל',
      tone: signals.missingNeeded.length ? 'red' : 'green',
    },
    possiblyUnnecessary: {
      value: signals.notNeeded.some(a => a.status === 'possibly_unnecessary'),
      labelHe: signals.notNeeded.some(a => a.status === 'possibly_unnecessary')
        ? signals.notNeeded.filter(a => a.status === 'possibly_unnecessary').map(a => a.titleHe).join(' · ')
        : 'לא זוהה כיסוי שנראה מיותר לפי הפרופיל',
      tone: signals.notNeeded.some(a => a.status === 'possibly_unnecessary') ? 'yellow' : 'green',
    },
    companyQuality: {
      value: signals.poorService.length === 0,
      labelHe: signals.poorService.length
        ? `מדד שירות נמוך אצל ${signals.poorService.map(r => r.provider || r.type).join(', ')}`
        : (health.score >= 75 ? 'מדד השירות סביר או טוב' : 'מדד שירות חלקי / לא מלא'),
      tone: signals.poorService.length ? 'red' : 'green',
    },
  };
}

/**
 * Main entry — one overall insurance decision + supporting views.
 */
function buildInsuranceDecision(profileDTO, analysis, marketAdvice = {}, options = {}) {
  const policies = options.policies
    || analysis.aggregatedPolicies
    || profileDTO?.policies
    || [];

  const signals = collectSignals(analysis, marketAdvice, policies);
  const health = computeHealthScore(signals);
  const status = decideOverallStatus(signals, health);
  const meta = STATUS_META[status];
  const executiveActions = buildExecutiveActions(signals, analysis);
  const companyQuality = buildCompanyQualityView(marketAdvice);
  const quickAnswers = buildQuickAnswers(signals, status, health);

  const profileInsights = (analysis.needAssessments || []).map(a => ({
    type: a.type,
    status: a.status,
    needed: a.needed,
    titleHe: a.titleHe,
    messageHe: a.messageHe,
    whyItMatters: a.whyItMatters || null,
  }));

  return {
    status,
    statusLabelHe: meta.labelHe,
    statusTone: meta.badgeTone,
    statusSummaryHe: meta.summaryHe,
    healthScore: health.score,
    healthLabelHe: health.labelHe,
    healthLabelEn: health.labelEn,
    healthExplanation: health.explanationBullets,
    coverageCompleteness: signals.completeness,
    companyQuality,
    profileInsights,
    executiveActions,
    quickAnswers,
    portfolioOverview: marketAdvice.portfolioOverview || null,
    generatedAt: new Date().toISOString(),
    methodologyHe: 'החלטה דטרמיניסטית על בסיס פוליסות, פרופיל ומדד שירות — ללא השוואת מחירים וללא מודל שפה.',
  };
}

/**
 * Map decision → legacy healthCheck shape for existing UI/API consumers.
 */
function decisionToHealthCheck(decision, analysis = {}) {
  const categories = [
    {
      id: 'duplicates',
      label: 'כפילויות וחפיפות',
      status: decision.quickAnswers.hasDuplicates.tone === 'green' ? 'good' : 'warning',
      score: decision.quickAnswers.hasDuplicates.tone === 'green' ? 90 : 55,
      detail: decision.quickAnswers.hasDuplicates.labelHe,
    },
    {
      id: 'gaps',
      label: 'התאמה לפרופיל',
      status: decision.quickAnswers.missingImportant.tone === 'green' ? 'good' : 'warning',
      score: decision.quickAnswers.missingImportant.tone === 'green' ? 88 : 50,
      detail: decision.quickAnswers.missingImportant.labelHe,
    },
    {
      id: 'service',
      label: 'איכות שירות',
      status: decision.quickAnswers.companyQuality.tone === 'green' ? 'good' : 'warning',
      score: decision.companyQuality.averageServiceIndex ?? 70,
      detail: decision.quickAnswers.companyQuality.labelHe,
    },
    {
      id: 'completeness',
      label: 'שלמות מידע',
      status: (decision.coverageCompleteness || []).every(c => c.coverageConfidence !== 'low') ? 'good' : 'warning',
      score: decision.coverageCompleteness?.length
        ? Math.round(
          decision.coverageCompleteness.reduce((s, c) => s + c.completenessScore, 0)
            / decision.coverageCompleteness.length,
        )
        : 70,
      detail: `${decision.coverageCompleteness?.length || 0} פוליסות נבדקו לשלמות מידע`,
    },
  ];

  return {
    score: decision.healthScore,
    scoreDisabled: false,
    level: {
      level: decision.status,
      code: decision.status,
      label: `${decision.healthLabelHe} · ${decision.statusLabelHe}`,
    },
    headlineHe: 'ציון בריאות התיק הביטוחי',
    messageHe: decision.healthExplanation.join(' '),
    categories,
    meta: {
      status: decision.status,
      actionCount: decision.executiveActions.length,
      premiumUnderReviewMonthly: analysis.premiumUnderReviewMonthly ?? null,
    },
    disclaimer: decision.methodologyHe,
  };
}

module.exports = {
  STATUS,
  STATUS_META,
  buildInsuranceDecision,
  computeCoverageCompleteness,
  computeHealthScore,
  decideOverallStatus,
  buildExecutiveActions,
  decisionToHealthCheck,
  TYPE_LABELS,
};
