/**
 * Insurance Agent Tools
 * Flow: Agent → Tool → Service → DTO
 */

const UserProfile = require('../../models/UserProfile');
const { analyzeAggregatedInsurance } = require('../../services/insurancePolicyAggregationService');
const { analyzeCoverageGaps } = require('../../services/insurance/insuranceCoverageGapService');
const { buildPrimaryInsuranceRecommendations } = require('../../services/insurance/insuranceRecommendationService');

const COVERAGE_LABELS_HE = {
  life: 'ביטוח חיים',
  health: 'ביטוח בריאות',
  health_supplement: 'ביטוח בריאות משלים',
  disability: 'ביטוח אובדן כושר עבודה (אכ"ע)',
  apartment: 'ביטוח דירה',
  car: 'ביטוח רכב',
  mortgage: 'ביטוח משכנתא',
  critical_illness: 'ביטוח מחלות קשות',
};

async function getInsuranceProfile(userId) {
  if (!userId) throw new Error('userId is required');
  const profile = await UserProfile.findOne({ user: userId }).lean();
  if (!profile) return { hasProfile: false, policies: [], profile: null };

  const ins = profile.insurance || {};
  const onboardingAnswers = profile.insuranceOnboarding?.answers || {};

  return {
    hasProfile: true,
    profile: {
      hasLifeInsurance: ins.hasLifeInsurance ?? null,
      hasHealthInsurance: ins.hasHealthInsurance ?? null,
      hasDisabilityInsurance: ins.hasDisabilityInsurance ?? null,
      hasApartmentInsurance: ins.hasApartmentInsurance ?? null,
      hasCarInsurance: ins.hasCarInsurance ?? null,
    },
    personal: {
      age: profile.personal?.age ?? null,
      maritalStatus: profile.personal?.maritalStatus ?? null,
      childrenCount: profile.personal?.childrenCount ?? null,
    },
    assets: {
      ownsApartment: profile.assets?.ownsApartment ?? null,
      ownsCar: profile.assets?.ownsCar ?? null,
      hasMortgage: profile.assets?.hasMortgage ?? null,
    },
    vehiclesOwned: onboardingAnswers['insuranceOnboarding.vehicle.vehiclesOwned']
      ?? onboardingAnswers.vehiclesOwned
      ?? null,
    vehicles: onboardingAnswers.vehicles ?? null,
    policies: [],
  };
}

function analyzeInsuranceCoverage(insuranceProfile, options = {}) {
  const { policies = [], profile, personal, assets, vehiclesOwned } = insuranceProfile;

  const aggResult = analyzeAggregatedInsurance(policies, { vehiclesOwned });
  const { aggregatedPolicies } = aggResult;

  const gapResult = analyzeCoverageGaps(
    { profile, personal, assets, insurance: profile },
    aggregatedPolicies,
    { pensionFunds: options.pensionFunds || [] },
  );

  const flags = [...(gapResult.flags || [])];
  if (personal?.maritalStatus === 'married' && profile?.hasLifeInsurance === false) {
    flags.push({ code: 'life_insurance_needed', urgency: 'high', label: 'ביטוח חיים מומלץ לנשואים — יש לבדוק סכומים ומטרה' });
  }

  return {
    aggregatedPolicies,
    normalizedPolicies: aggResult.normalizedPolicies,
    aggregationSummary: aggResult.aggregationSummary,
    duplicates: aggResult.duplicates,
    duplicateFindings: aggResult.duplicateFindings,
    duplicateCount: aggResult.duplicateCount,
    vehiclePackages: aggResult.vehiclePackages,
    vehicleVerificationNeeded: aggResult.vehicleVerificationNeeded,
    totalMonthlyWaste: 0,
    premiumUnderReviewMonthly: aggResult.premiumUnderReviewMonthly,
    verifiedSavingMonthly: 0,
    missingCoverage: gapResult.missingTypes,
    gapFindings: gapResult.gapFindings,
    missingUrgency: gapResult.urgency,
    flags,
    savings: {
      totalSavings: 0,
      annualSavings: 0,
      monthlyEstimate: 0,
      annualEstimate: 0,
      verified: false,
      premiumUnderReviewMonthly: aggResult.premiumUnderReviewMonthly,
    },
    hasCriticalGap: gapResult.gapFindings.some(g => g.type === 'disability'),
    disabilityCheckedSources: gapResult.disabilityCheckedSources,
  };
}

function generateInsuranceRecommendations(analysisResult, marketAdvice = null) {
  return buildPrimaryInsuranceRecommendations(analysisResult, marketAdvice || {});
}

module.exports = {
  getInsuranceProfile,
  analyzeInsuranceCoverage,
  generateInsuranceRecommendations,
  COVERAGE_LABELS_HE,
};
