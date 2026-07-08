'use strict';

/**
 * Insurance Market Advisor — cost vs service index vs market baseline.
 * Verdicts: STAY | REVIEW | SWITCH
 */
const { getPriceRange, getPricingDisclaimer } = require('./insurancePricingTables');
const { compareUserPremium, getSourceMetadata } = require('./insurancePricingDatasetService');
const { loadServiceIndex, lookupProviderScores } = require('./insuranceGovDataService');
const { getTopProvidersByService } = require('../config/insuranceServiceIndexTables');
const { analyzeInsuranceCoverage } = require('../ai/tools/insuranceTools');

const VERDICT = {
  STAY: 'STAY',
  REVIEW: 'REVIEW',
  SWITCH: 'SWITCH',
};

const VERDICT_HE = {
  STAY: 'הישאר אצל הממבטח',
  REVIEW: 'בדוק מחדש / נהל משא ומר',
  SWITCH: 'שקול חברה',
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

function premiumVsMarket(monthlyPremium, baseline) {
  if (monthlyPremium == null || !baseline?.average) return 'unknown';
  if (monthlyPremium <= baseline.min) return 'below_market';
  if (monthlyPremium <= baseline.average * 1.08) return 'fair';
  if (monthlyPremium <= baseline.max) return 'above_market';
  return 'high';
}

function mapAssessmentToPremiumStatus(assessment) {
  if (assessment === 'low') return 'below_market';
  if (assessment === 'normal') return 'fair';
  if (assessment === 'high') return 'above_market';
  if (assessment === 'very_high') return 'high';
  return 'unknown';
}

function serviceTier(serviceIndex) {
  if (serviceIndex == null) return 'unknown';
  if (serviceIndex >= STRONG_SERVICE_THRESHOLD) return 'excellent';
  if (serviceIndex >= POOR_SERVICE_THRESHOLD) return 'fair';
  return 'poor';
}

function decideVerdict({ premiumStatus, serviceIndex, serviceTier: tier, monthlyOverpay }) {
  if (tier === 'poor' || (serviceIndex != null && serviceIndex < POOR_SERVICE_THRESHOLD)) {
    return VERDICT.SWITCH;
  }
  if (premiumStatus === 'high' || (premiumStatus === 'above_market' && monthlyOverpay > 150)) {
    return serviceIndex != null && serviceIndex >= STRONG_SERVICE_THRESHOLD
      ? VERDICT.REVIEW
      : VERDICT.SWITCH;
  }
  if (premiumStatus === 'above_market' || tier === 'fair') {
    return VERDICT.REVIEW;
  }
  return VERDICT.STAY;
}

function buildPolicyNarrative(verdict, ctx) {
  const {
    provider, typeLabel, monthlyPremium, baseline, serviceIndex, claimPaymentRate,
    alternatives, monthlyOverpay,
  } = ctx;

  if (verdict === VERDICT.STAY) {
    return `${typeLabel} אצל ${provider || 'המבטח'} — פרמיה ₪${monthlyPremium}/חודש (ממוצע שוק ₪${baseline.average}), מדד שירות ${serviceIndex}/100, תשלום תביעות ~${claimPaymentRate}%. כיסוי במחיר ובשירות סבירים — מומלץ להישאר.`;
  }
  if (verdict === VERDICT.REVIEW) {
    return `${typeLabel} אצל ${provider} — פרמיה ₪${monthlyPremium}/חודש גבוהה ב-~₪${Math.round(monthlyOverpay)}/חודש מהממוצע (₪${baseline.average}). מדד השירות ${serviceIndex}/100 — החברה מספקת שירות סביר, אך כדאי לנהל משא ומר או להשוות הצעות.`;
  }
  const altText = (alternatives || []).map(a => `${a.displayName} (מדד ${a.serviceIndex})`).join(', ');
  return `${typeLabel} אצל ${provider} — מדד שירות ${serviceIndex}/100 ו/או פרמיה מעל השוק. אחוז תשלום תביעות ~${claimPaymentRate}% — נמוך מהמובילים. שקלי: ${altText || 'חברות עם מדד שירות גבוה'}.`;
}

function analyzePolicy(policy, profileDTO, govRows, duplicateTypes) {
  const personal = profileDTO?.personal || {};
  const monthlyPremium = policy.monthlyPremium ?? null;
  const baseline = getPriceRange(policy.type, {
    age: personal.age,
    gender: personal.gender,
    grossMonthly: profileDTO?.employment?.expectedMonthlyGross,
    salaryRange: profileDTO?.financial?.salaryRange,
    childrenCount: personal.childrenCount,
    coverageAmount: policy.coverageAmount,
  });

  const pricingCompare = compareUserPremium(policy.monthlyPremium, policy.type, {
    age: personal.age,
    gender: personal.gender,
    grossMonthly: profileDTO?.employment?.expectedMonthlyGross,
    salaryRange: profileDTO?.financial?.salaryRange,
    childrenCount: personal.childrenCount,
    coverageAmount: policy.coverageAmount,
  });

  const service = lookupProviderScores(policy.provider, policy.type, govRows);
  const premStatus = mapAssessmentToPremiumStatus(pricingCompare.assessment)
    || premiumVsMarket(monthlyPremium, baseline);
  const monthlyOverpay = monthlyPremium != null && baseline.average
    ? Math.max(0, monthlyPremium - baseline.average)
    : 0;
  const tier = serviceTier(service.serviceIndex);
  const isDuplicate = duplicateTypes.has(policy.type);

  const verdict = decideVerdict({
    premiumStatus: premStatus,
    serviceIndex: service.serviceIndex,
    serviceTier: tier,
    monthlyOverpay,
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
    monthlyPremium,
    coverageAmount: policy.coverageAmount,
    comparisonMatrix: {
      cost: {
        userMonthlyPremium: monthlyPremium,
        marketBaselineMin: baseline.min,
        marketBaselineAvg: baseline.average,
        marketBaselineMax: baseline.max,
        premiumVsMarket: premStatus,
        monthlyOverpayVsAvg: monthlyOverpay,
        annualOverpayVsAvg: Math.round(monthlyOverpay * 12),
      },
      service: {
        serviceIndex: service.serviceIndex,
        claimPaymentRate: service.claimPaymentRate,
        satisfactionScore: service.satisfactionScore,
        serviceTier: tier,
        serviceSource: service.source,
      },
      marketBaseline: {
        premiumRange: baseline,
        marketClaimPaymentRate: 82,
        marketServiceIndex: 80,
        pricingSource: pricingCompare.source,
      },
      pricingComparison: pricingCompare,
    },
    duplicateCoverage: isDuplicate,
    verdict,
    verdictLabelHe: VERDICT_HE[verdict],
    summaryHe: buildPolicyNarrative(verdict, {
      provider: policy.provider,
      typeLabel: TYPE_LABELS[policy.type] || policy.type,
      monthlyPremium,
      baseline,
      serviceIndex: service.serviceIndex,
      claimPaymentRate: service.claimPaymentRate,
      alternatives,
      monthlyOverpay,
    }),
    alternatives,
  };
}

function normalizeText(s) {
  return String(s || '').trim().toLowerCase();
}

/**
 * @param {object[]} policies
 * @param {object} profileDTO - from getInsuranceProfile + policies
 * @param {object} [options]
 */
async function buildMarketAdvice(policies, profileDTO, options = {}) {
  const active = (policies || []).filter(p => p.status !== 'cancelled' && p.status !== 'expired');
  if (!active.length) {
    return {
      hasData: false,
      message: 'לא נמצאו פוליסות. ייבא דוח מהר הביטוח.',
      policies: [],
      comparisonMatrix: [],
      overallVerdict: null,
    };
  }

  const { rows: govRows, source, cached, warning } = await loadServiceIndex({
    forceRefresh: Boolean(options.forceRefresh),
  });

  const coverage = analyzeInsuranceCoverage(profileDTO);
  const duplicateTypes = new Set((coverage.duplicates || []).map(d => d.type));

  const policyAdvice = active.map(p =>
    analyzePolicy(p, profileDTO, govRows, duplicateTypes),
  );

  const comparisonMatrix = policyAdvice.map(p => ({
    policyId: p.policyId,
    type: p.typeLabelHe,
    provider: p.provider,
    userCost: p.comparisonMatrix.cost.userMonthlyPremium,
    marketAvg: p.comparisonMatrix.cost.marketBaselineAvg,
    serviceScore: p.comparisonMatrix.service.serviceIndex,
    claimPaymentRate: p.comparisonMatrix.service.claimPaymentRate,
    premiumVsMarket: p.comparisonMatrix.cost.premiumVsMarket,
    duplicate: p.duplicateCoverage,
    verdict: p.verdict,
  }));

  const verdictCounts = policyAdvice.reduce((acc, p) => {
    acc[p.verdict] = (acc[p.verdict] || 0) + 1;
    return acc;
  }, {});

  const overallVerdict = verdictCounts[VERDICT.SWITCH]
    ? VERDICT.SWITCH
    : verdictCounts[VERDICT.REVIEW]
      ? VERDICT.REVIEW
      : VERDICT.STAY;

  const totalAnnualOverpay = policyAdvice.reduce(
    (s, p) => s + (p.comparisonMatrix.cost.annualOverpayVsAvg || 0),
    0,
  );
  const duplicateWaste = coverage.totalMonthlyWaste ?? 0;

  const pricingMeta = getSourceMetadata();
  const pricingDisclaimer = getPricingDisclaimer();

  return {
    hasData: true,
    role: 'Insurance Analyst & Risk Management Expert',
    dataSource: source,
    dataCached: Boolean(cached),
    dataWarning: warning || null,
    pricingSource: pricingMeta,
    policies: policyAdvice,
    comparisonMatrix,
    duplicates: coverage.duplicates || [],
    duplicateCount: coverage.duplicateCount ?? 0,
    totalMonthlyDuplicateWaste: duplicateWaste,
    overallVerdict,
    overallVerdictLabelHe: VERDICT_HE[overallVerdict],
    summary: {
      policyCount: policyAdvice.length,
      verdictCounts,
      totalAnnualOverpayVsMarket: totalAnnualOverpay,
      totalAnnualDuplicateWaste: Math.round(duplicateWaste * 12),
    },
    recommendationHe: overallVerdict === VERDICT.STAY
      ? 'פרופיל הביטוח מאוזן — מחירים ומדד שירות בתוך טווח השוק.'
      : overallVerdict === VERDICT.REVIEW
        ? 'יש מקום לייעול — נהל משא ומר על פרמיות ובדוק כפילויות לפני החלפת מכרז.'
        : 'מומלץ לבחון מחדש חברות עם מדד שירות גבוה יותר — במיוחד אחוז תשלום תביעות.',
    disclaimer: pricingDisclaimer.he,
    disclaimerEn: pricingDisclaimer.en,
    disclaimerLegacy: 'המידע מבוסס על מדד שירות ומדגם מחירים מקומי — אינו ייעוץ ביטוחי. יש להתייעץ עם סוכן ביטוח מורשה.',
  };
}

module.exports = {
  VERDICT,
  VERDICT_HE,
  buildMarketAdvice,
  analyzePolicy,
  premiumVsMarket,
  serviceTier,
};
