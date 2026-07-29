'use strict';

/**
 * Insurance Portfolio Advisor — company service quality + portfolio signals.
 * No premium benchmarking / market-average price comparisons.
 * Verdicts: STAY | REVIEW | SWITCH (service-quality only).
 */

const { loadServiceIndex, lookupProviderScores } = require('./insuranceGovDataService');
const { getTopProvidersByService } = require('../config/insuranceServiceIndexTables');
const { analyzeInsuranceCoverage } = require('../ai/tools/insuranceTools');

const VERDICT = {
  STAY: 'STAY',
  REVIEW: 'REVIEW',
  SWITCH: 'SWITCH',
};

const VERDICT_HE = {
  STAY: 'מדד השירות סביר — אין אינדיקציה אובייקטיבית להחלפה',
  REVIEW: 'כדאי לבדוק את איכות השירות והכיסוי',
  SWITCH: 'מדד שירות נמוך — שקול חברה עם מדד גבוה יותר',
};

const TYPE_LABELS = {
  life: 'ביטוח חיים',
  health: 'ביטוח בריאות',
  disability: 'נכות / אכ"ע',
  apartment: 'ביטוח דירה',
  car: 'ביטוח רכב',
  mortgage: 'ביטוח משכנתא',
  critical_illness: 'מחלות קשות',
  other: 'אחר',
};

const POOR_SERVICE_THRESHOLD = 70;
const STRONG_SERVICE_THRESHOLD = 82;

function serviceTier(serviceIndex) {
  if (serviceIndex == null) return 'unknown';
  if (serviceIndex >= STRONG_SERVICE_THRESHOLD) return 'excellent';
  if (serviceIndex >= POOR_SERVICE_THRESHOLD) return 'fair';
  return 'poor';
}

/**
 * Verdict from service quality + duplicate signal only — never from premium.
 */
function decideVerdict({ serviceIndex, serviceTier: tier, isDuplicate }) {
  if (tier === 'poor' || (serviceIndex != null && serviceIndex < POOR_SERVICE_THRESHOLD)) {
    return VERDICT.SWITCH;
  }
  if (isDuplicate || tier === 'fair' || serviceIndex == null) {
    return VERDICT.REVIEW;
  }
  return VERDICT.STAY;
}

function buildPolicyNarrative(verdict, ctx) {
  const {
    provider, typeLabel, serviceIndex, claimPaymentRate, satisfactionScore, alternatives, isDuplicate,
  } = ctx;

  const servicePart = serviceIndex != null
    ? `מדד שירות ${serviceIndex}/100`
    : 'אין מדד שירות זמין';
  const claimPart = claimPaymentRate != null
    ? `אחוז תשלום תביעות ~${claimPaymentRate}%`
    : null;
  const satPart = satisfactionScore != null
    ? `שביעות לקוחות ~${satisfactionScore}`
    : null;
  const facts = [servicePart, claimPart, satPart].filter(Boolean).join(', ');

  if (verdict === VERDICT.STAY) {
    return `${typeLabel} אצל ${provider || 'המבטח'} — ${facts}. אין אינדיקציה אובייקטיבית להחלפת חברה.`;
  }
  if (verdict === VERDICT.REVIEW) {
    const dupNote = isDuplicate ? ' זוהתה חפיפה אפשרית בכיסוי — כדאי לוודא.' : '';
    return `${typeLabel} אצל ${provider || 'המבטח'} — ${facts}.${dupNote} מומלץ לבדוק את תנאי הכיסוי מול סוכן מורשה.`;
  }
  const altText = (alternatives || []).map(a => `${a.displayName} (מדד ${a.serviceIndex})`).join(', ');
  return `${typeLabel} אצל ${provider || 'המבטח'} — ${facts}. מדד השירות נמוך יחסית — כדאי לשקול חברות עם מדד גבוה יותר: ${altText || 'לפי מדד השירות הממשלתי'}.`;
}

function buildCoverageSummary(policy) {
  const missing = [];
  if (policy.coverageAmount == null) missing.push('סכום כיסוי');
  if (!policy.provider) missing.push('שם חברה');
  if (!policy.policyNumber) missing.push('מספר פוליסה');
  if (policy.startDate == null && policy.endDate == null) missing.push('תאריכי תוקף');

  return {
    policyId: policy.id,
    coverageType: policy.type,
    coverageTypeLabelHe: TYPE_LABELS[policy.type] || policy.type,
    provider: policy.provider || null,
    status: policy.status || 'active',
    mainProtections: TYPE_LABELS[policy.type] || policy.type,
    monthlyPremium: policy.monthlyPremium ?? null,
    coverageAmount: policy.coverageAmount ?? null,
    missingInformation: missing,
    manualReviewRecommended: missing.length >= 2 || !policy.provider,
  };
}

function analyzePolicy(policy, govRows, duplicateTypes) {
  const service = lookupProviderScores(policy.provider, policy.type, govRows);
  const tier = serviceTier(service.serviceIndex);
  const isDuplicate = duplicateTypes.has(policy.type);

  const verdict = decideVerdict({
    serviceIndex: service.serviceIndex,
    serviceTier: tier,
    isDuplicate,
  });

  const alternatives = verdict === VERDICT.SWITCH
    ? getTopProvidersByService(2, policy.type).filter(a =>
      normalizeText(a.displayName) !== normalizeText(policy.provider),
    )
    : [];

  return {
    policyId: policy.id,
    type: policy.type,
    typeLabelHe: TYPE_LABELS[policy.type] || policy.type,
    provider: policy.provider,
    policyNumber: policy.policyNumber,
    monthlyPremium: policy.monthlyPremium ?? null,
    coverageAmount: policy.coverageAmount ?? null,
    coverageSummary: buildCoverageSummary(policy),
    comparisonMatrix: {
      service: {
        serviceIndex: service.serviceIndex,
        claimPaymentRate: service.claimPaymentRate,
        satisfactionScore: service.satisfactionScore,
        serviceTier: tier,
        serviceSource: service.source,
      },
    },
    duplicateCoverage: isDuplicate,
    comparisonQuality: service.serviceIndex != null ? 'service_only' : 'insufficient_service_data',
    comparisonNoteHe: service.serviceIndex == null
      ? 'אין מדד שירות זמין לחברה זו — לא ניתן להעריך איכות שירות.'
      : null,
    verdict,
    verdictLabelHe: VERDICT_HE[verdict],
    summaryHe: buildPolicyNarrative(verdict, {
      provider: policy.provider,
      typeLabel: TYPE_LABELS[policy.type] || policy.type,
      serviceIndex: service.serviceIndex,
      claimPaymentRate: service.claimPaymentRate,
      satisfactionScore: service.satisfactionScore,
      alternatives,
      isDuplicate,
    }),
    alternatives,
  };
}

function normalizeText(s) {
  return String(s || '').trim().toLowerCase();
}

/**
 * @param {object[]} policies
 * @param {object} profileDTO
 * @param {object} [options]
 */
async function buildMarketAdvice(policies, profileDTO, options = {}) {
  const active = (policies || []).filter(p => p.status !== 'cancelled' && p.status !== 'expired');
  const inactive = (policies || []).filter(p => p.status === 'cancelled' || p.status === 'expired');

  if (!active.length && !inactive.length) {
    return {
      hasData: false,
      message: 'לא נמצאו פוליסות. ייבא דוח מהר הביטוח.',
      policies: [],
      comparisonMatrix: [],
      coverageSummaries: [],
      portfolioOverview: null,
      overallVerdict: null,
    };
  }

  const { rows: govRows, source, cached, warning } = await loadServiceIndex({
    forceRefresh: Boolean(options.forceRefresh),
  });

  const coverage = options.analysis || analyzeInsuranceCoverage(profileDTO);
  const duplicateTypes = new Set(
    (coverage.duplicates || [])
      .filter(d => d.status === 'likely_duplicate' || d.status === 'possible_overlap')
      .map(d => d.type || d.coverageFamily)
      .filter(Boolean),
  );

  const policyAdvice = active.map(p => analyzePolicy(p, govRows, duplicateTypes));
  const coverageSummaries = [
    ...policyAdvice.map(p => p.coverageSummary),
    ...inactive.map(p => buildCoverageSummary(p)),
  ];

  const comparisonMatrix = policyAdvice.map(p => ({
    policyId: p.policyId,
    type: p.typeLabelHe,
    provider: p.provider,
    serviceScore: p.comparisonMatrix.service.serviceIndex,
    claimPaymentRate: p.comparisonMatrix.service.claimPaymentRate,
    satisfactionScore: p.comparisonMatrix.service.satisfactionScore,
    serviceTier: p.comparisonMatrix.service.serviceTier,
    serviceSource: p.comparisonMatrix.service.serviceSource,
    comparisonQuality: p.comparisonQuality,
    comparisonNoteHe: p.comparisonNoteHe,
    duplicate: p.duplicateCoverage,
    verdict: p.verdict,
  }));

  const companies = [...new Set(
    (policies || []).map(p => p.provider).filter(Boolean),
  )];
  const types = [...new Set(
    (policies || []).map(p => p.type).filter(Boolean),
  )];

  const portfolioOverview = {
    policyCount: (policies || []).length,
    activeCount: active.length,
    inactiveCount: inactive.length,
    companies,
    policyTypes: types.map(t => ({ type: t, labelHe: TYPE_LABELS[t] || t })),
  };

  const verdictCounts = policyAdvice.reduce((acc, p) => {
    acc[p.verdict] = (acc[p.verdict] || 0) + 1;
    return acc;
  }, {});

  const overallVerdict = verdictCounts[VERDICT.SWITCH]
    ? VERDICT.SWITCH
    : verdictCounts[VERDICT.REVIEW] || coverage.duplicateCount > 0 || (coverage.missingCoverage || []).length
      ? VERDICT.REVIEW
      : VERDICT.STAY;

  const premiumUnderReview = coverage.premiumUnderReviewMonthly ?? 0;
  const avgService = (() => {
    const scores = policyAdvice
      .map(p => p.comparisonMatrix.service.serviceIndex)
      .filter(s => s != null);
    if (!scores.length) return null;
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  })();

  return {
    hasData: true,
    role: 'Insurance Portfolio Health Check',
    dataSource: source,
    dataCached: Boolean(cached),
    dataWarning: warning || null,
    pricingSource: null,
    policies: policyAdvice,
    comparisonMatrix,
    coverageSummaries,
    portfolioOverview,
    companyQuality: {
      averageServiceIndex: avgService,
      averageServiceTier: serviceTier(avgService),
      source,
    },
    duplicates: coverage.duplicates || [],
    duplicateCount: coverage.duplicateCount ?? 0,
    totalMonthlyDuplicateWaste: 0,
    premiumUnderReviewMonthly: premiumUnderReview || null,
    overallVerdict,
    overallVerdictLabelHe: VERDICT_HE[overallVerdict],
    summary: {
      policyCount: policyAdvice.length,
      verdictCounts,
      totalAnnualOverpayVsMarket: 0,
      totalAnnualDuplicateWaste: 0,
      premiumUnderReviewMonthly: premiumUnderReview || null,
      averageServiceIndex: avgService,
    },
    recommendationHe: overallVerdict === VERDICT.STAY
      ? 'תיק הביטוח נראה תקין מבחינת מדד שירות — המשיכו לעקוב אחרי כפילויות ופערי כיסוי.'
      : overallVerdict === VERDICT.REVIEW
        ? 'יש נקודות לבדיקה — כפילויות, פערי כיסוי או מדד שירות בינוני. אין המלצה להחלפה על בסיס מחיר.'
        : 'נמצא מדד שירות נמוך באחת או יותר מהפוליסות — שקלו חברה עם מדד גבוה יותר לפי נתוני השירות.',
    disclaimer: 'הניתוח מבוסס על פוליסות שהועלו, פרופיל האונבורדינג ומדד השירות — אינו כולל השוואת פרמיות ואינו ייעוץ ביטוחי. יש להתייעץ עם סוכן מורשה.',
    disclaimerEn: 'Analysis is based on uploaded policies, onboarding profile and service index — not premium quotes. Not insurance advice.',
    disclaimerLegacy: 'המידע מבוסס על מדד שירות ופרופיל הכיסוי — אינו ייעוץ ביטוחי.',
  };
}

module.exports = {
  VERDICT,
  VERDICT_HE,
  buildMarketAdvice,
  analyzePolicy,
  decideVerdict,
  serviceTier,
  buildCoverageSummary,
  TYPE_LABELS,
};
