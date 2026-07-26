'use strict';

const {
  COVERAGE_FAMILIES,
  labelCoverageFamily,
  isVehicleFamily,
} = require('./insuranceCoverageTaxonomy');
const { groupProbableVehiclePackages } = require('./insuranceVehicleGroupingService');

/**
 * Evidence-based duplicate / overlap analysis.
 * Never treats "multiple policies in broad category" as confirmed waste.
 */

function sumPremiums(policies, policyIds) {
  const idSet = new Set(policyIds);
  return (policies || [])
    .filter(p => idSet.has(p.policyId))
    .reduce((s, p) => s + (p.premiumMonthly || 0), 0);
}

function buildFindingBase(coverageFamily, policyIds, normalizedPolicies) {
  const involved = (normalizedPolicies || []).filter(p => policyIds.includes(p.policyId));
  return {
    coverageFamily,
    coverageFamilyLabelHe: labelCoverageFamily(coverageFamily),
    policyIds,
    policies: involved.map(p => ({
      policyId: p.policyId,
      provider: p.insurer,
      policyNumber: p.policyNumber,
      monthlyPremium: p.premiumMonthly,
    })),
    policyCount: policyIds.length,
    overlapPeriod: null,
    sameInsuredAsset: null,
    comparableBenefits: null,
    verifiedSavingMonthly: null,
    recommendCancellation: false,
    isCatastrophic: false,
    kupatHolimOverlap: false,
  };
}

function analyzeVehicleOverlap(normalizedPolicies, options = {}) {
  const findings = [];
  const vehiclePackages = groupProbableVehiclePackages(normalizedPolicies);
  const packageCount = vehiclePackages.length;
  const vehiclesOwned = options.vehiclesOwned ?? null;

  if (packageCount <= 1) {
    return { findings, vehiclePackages, vehicleVerificationNeeded: false };
  }

  const allVehiclePolicyIds = vehiclePackages.flatMap(g => g.policyIds);
  const premiumUnderReview = sumPremiums(normalizedPolicies, allVehiclePolicyIds);

  if (vehiclesOwned == null) {
    findings.push({
      ...buildFindingBase('vehicle_packages', allVehiclePolicyIds, normalizedPolicies),
      status: 'insufficient_data',
      confidence: 'insufficient',
      premiumUnderReviewMonthly: premiumUnderReview,
      reasons: [
        `נמצאו כ-${packageCount} חבילות ביטוח רכב אפשריות`,
        'לא ניתן לקבוע כפילות ללא מספר הרכבים הרשומים על שמך',
      ],
      missingInputs: ['vehiclesOwned'],
      reasonHe: `נמצאו מספר פוליסות רכב. כדי לבדוק אם קיימת חפיפה, יש להשלים כמה רכבים רשומים על שמך.`,
      typeLabelHe: 'ביטוח רכב — לבדיקה',
    });
    return { findings, vehiclePackages, vehicleVerificationNeeded: true };
  }

  if (vehiclesOwned >= packageCount) {
    findings.push({
      ...buildFindingBase('vehicle_packages', allVehiclePolicyIds, normalizedPolicies),
      status: 'no_duplicate_indication',
      confidence: 'medium',
      premiumUnderReviewMonthly: null,
      reasons: [
        `${packageCount} חבילות רכב אפשריות מול ${vehiclesOwned} רכבים שדווחו`,
        'מספר החבילות תואם או נמוך ממספר הרכבים — אין אינדיקציה לכפילות',
      ],
      missingInputs: [],
      reasonHe: `נמצאו ${packageCount} חבילות ביטוח רכב — תואם ל-${vehiclesOwned} רכבים שדיווחת.`,
      typeLabelHe: 'ביטוח רכב',
    });
    return { findings, vehiclePackages, vehicleVerificationNeeded: false };
  }

  findings.push({
    ...buildFindingBase('vehicle_packages', allVehiclePolicyIds, normalizedPolicies),
    status: 'possible_overlap',
    confidence: 'low',
    premiumUnderReviewMonthly: premiumUnderReview,
    sameInsuredAsset: false,
    reasons: [
      `${packageCount} חבילות רכב אפשריות מול ${vehiclesOwned} רכבים שדווחו`,
      'ייתכן שיש כיסוי כפול — נדרש שיוך פוליסות לרכבים',
    ],
    missingInputs: ['vehiclePolicyAssignment'],
    reasonHe: 'קיימת חפיפה אפשרית בין פוליסות רכב — נדרש שיוך כל פוליסה לרכב.',
    typeLabelHe: 'ביטוח רכב — חפיפה אפשרית',
  });

  return { findings, vehiclePackages, vehicleVerificationNeeded: false };
}

function analyzeFamilyOverlap(coverageFamily, policyIds, normalizedPolicies) {
  if (policyIds.length < 2) return null;

  const finding = buildFindingBase(coverageFamily, policyIds, normalizedPolicies);
  const premiumUnderReview = sumPremiums(normalizedPolicies, policyIds);

  if (coverageFamily === COVERAGE_FAMILIES.PERSONAL_ACCIDENT) {
    return {
      ...finding,
      status: 'possible_overlap',
      confidence: 'low',
      comparableBenefits: false,
      premiumUnderReviewMonthly: premiumUnderReview,
      reasons: [
        'נמצאו מספר פוליסות תאונות אישיות',
        'יש להשוות סכומי כיסוי ותנאים לפני קביעת כפילות',
      ],
      missingInputs: ['benefitAmounts', 'policyTerms'],
      reasonHe: 'חפיפה אפשרית לבדיקה — יש להשוות סכומי כיסוי ותנאים.',
      typeLabelHe: labelCoverageFamily(coverageFamily),
    };
  }

  if (coverageFamily === COVERAGE_FAMILIES.LIFE_DEATH) {
    return {
      ...finding,
      status: 'insufficient_data',
      confidence: 'insufficient',
      premiumUnderReviewMonthly: null,
      reasons: [
        'נמצאו מספר פוליסות חיים (למשל קבוצתי ופרטי)',
        'לא ניתן לקבוע כפילות ללא סכומי ביטוח, מוטבים ומטרת כל פוליסה',
      ],
      missingInputs: ['coverageAmounts', 'beneficiaries', 'policyPurpose'],
      reasonHe: 'נדרשת בדיקת סכומי הביטוח ומטרת כל פוליסה.',
      typeLabelHe: 'ביטוח חיים — לבדיקה',
    };
  }

  if (isVehicleFamily(coverageFamily)) {
    return null;
  }

  // Different product families should never be grouped — caller buckets by family
  return {
    ...finding,
    status: 'possible_overlap',
    confidence: 'low',
    premiumUnderReviewMonthly: premiumUnderReview,
    reasons: [
      `נמצאו ${policyIds.length} פוליסות באותה משפחת כיסוי (${labelCoverageFamily(coverageFamily)})`,
      'נדרשת השוואת תנאים וסכומים לפני קביעת כפילות',
    ],
    missingInputs: ['benefitComparison'],
    reasonHe: 'נמצאו מספר כיסויים הדורשים בדיקה.',
    typeLabelHe: labelCoverageFamily(coverageFamily),
  };
}

/**
 * @param {object[]} normalizedPolicies
 * @param {object} [options]
 * @param {number|null} [options.vehiclesOwned]
 * @returns {{ findings: object[], duplicateFindings: object[], vehiclePackages: object[], overlapReviewCount: number, verifiedSavingMonthly: number, premiumUnderReviewMonthly: number }}
 */
function analyzeDuplicateCoverage(normalizedPolicies, options = {}) {
  const vehicleResult = analyzeVehicleOverlap(normalizedPolicies, options);
  const findings = [...vehicleResult.findings];

  const byFamily = new Map();
  for (const policy of normalizedPolicies || []) {
    const families = policy.productTypes?.length
      ? policy.productTypes
      : ['unknown'];

    for (const family of families) {
      if (family === 'unknown' || isVehicleFamily(family) || family === 'vehicle_packages') continue;
      if (!byFamily.has(family)) byFamily.set(family, new Set());
      byFamily.get(family).add(policy.policyId);
    }
  }

  for (const [family, idSet] of byFamily.entries()) {
    const policyIds = [...idSet];
    const overlap = analyzeFamilyOverlap(family, policyIds, normalizedPolicies);
    if (overlap) findings.push(overlap);
  }

  const overlapFindings = findings.filter(f =>
    f.status === 'possible_overlap' || f.status === 'likely_duplicate',
  );

  const premiumUnderReviewMonthly = overlapFindings.reduce(
    (s, f) => s + (f.premiumUnderReviewMonthly || 0),
    0,
  );

  return {
    findings,
    duplicateFindings: overlapFindings,
    vehiclePackages: vehicleResult.vehiclePackages,
    vehicleVerificationNeeded: vehicleResult.vehicleVerificationNeeded,
    overlapReviewCount: overlapFindings.length,
    verifiedSavingMonthly: 0,
    premiumUnderReviewMonthly: premiumUnderReviewMonthly || null,
  };
}

/**
 * Map evidence findings to legacy duplicate DTO shape (without false waste).
 */
function mapFindingsToLegacyDuplicates(findings) {
  return (findings || [])
    .filter(f => f.status !== 'no_duplicate_indication')
    .map(f => ({
      type: f.coverageFamily,
      typeLabelHe: f.typeLabelHe || f.coverageFamilyLabelHe,
      policies: f.policies,
      policyCount: f.policyCount,
      status: f.status,
      confidence: f.confidence,
      estimatedMonthlyWaste: null,
      premiumUnderReviewMonthly: f.premiumUnderReviewMonthly,
      verifiedSavingMonthly: f.verifiedSavingMonthly,
      recommendCancellation: false,
      isCatastrophic: f.isCatastrophic || false,
      kupatHolimOverlap: f.kupatHolimOverlap || false,
      reasonHe: f.reasonHe,
      missingInputs: f.missingInputs || [],
      reasons: f.reasons || [],
      sameInsuredAsset: f.sameInsuredAsset,
      comparableBenefits: f.comparableBenefits,
    }));
}

module.exports = {
  analyzeDuplicateCoverage,
  analyzeVehicleOverlap,
  analyzeFamilyOverlap,
  mapFindingsToLegacyDuplicates,
};
