/**
 * Insurance Agent Tools
 * Flow: Agent → Tool → Service → DTO
 */

'use strict';

const UserProfile = require('../../models/UserProfile');
const { runInsuranceDuplicateRules, runMissingCoverageRules } = require('../engines/ruleEngine');
const { estimateInsuranceSavings } = require('../engines/calculationEngine');

// ── Tool: getInsuranceProfile ─────────────────────────────────────────────────

/**
 * Get user's insurance profile from UserProfile (onboarding answers).
 * @param {string} userId
 * @returns {Promise<InsuranceProfileDTO>}
 */
async function getInsuranceProfile(userId) {
  if (!userId) throw new Error('userId is required');
  const profile = await UserProfile.findOne({ user: userId }).lean();
  if (!profile) return { hasProfile: false, policies: [], profile: null };

  const ins = profile.insurance || {};
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
    // Will be populated when InsurancePolicy model data exists
    policies: [],
  };
}

// ── Tool: analyzeInsuranceCoverage ────────────────────────────────────────────

/**
 * Run duplicate + gap detection and estimate savings.
 * @param {object} insuranceProfile - from getInsuranceProfile
 * @returns {InsuranceAnalysisDTO}
 */
function analyzeInsuranceCoverage(insuranceProfile) {
  const { policies = [], profile, personal, assets } = insuranceProfile;

  const duplicateResult = runInsuranceDuplicateRules(policies);
  const missingResult = runMissingCoverageRules({ insurance: profile, personal, assets }, policies);
  const savingsResult = estimateInsuranceSavings(duplicateResult.duplicates);

  // Build profile-based flags
  const flags = [];
  if (personal?.maritalStatus === 'married' && profile?.hasLifeInsurance === false) {
    flags.push({ code: 'life_insurance_needed', urgency: 'high', label: 'ביטוח חיים מומלץ לנשואים' });
  }
  if (!profile?.hasDisabilityInsurance) {
    flags.push({ code: 'disability_recommended', urgency: 'high', label: 'ביטוח אכ"ע מומלץ לשכירים' });
  }

  return {
    duplicates: duplicateResult.duplicates,
    duplicateCount: duplicateResult.duplicates.length,
    totalMonthlyWaste: duplicateResult.totalWaste,
    missingCoverage: missingResult.missingTypes,
    missingUrgency: missingResult.urgency,
    flags,
    savings: savingsResult,
    hasCriticalGap: missingResult.urgency === 'high' || duplicateResult.duplicates.length > 0,
  };
}

// ── Tool: generateInsuranceRecommendations ────────────────────────────────────

/**
 * @param {object} analysisResult - from analyzeInsuranceCoverage
 * @returns {Array<RecommendationDTO>}
 */
function generateInsuranceRecommendations(analysisResult) {
  const recs = [];

  for (const dup of analysisResult.duplicates || []) {
    recs.push({
      type: 'duplicate_insurance',
      title: `ביטוח כפול — ${dup.type}`,
      reason: `יש לך ${dup.policies.length} פוליסות לאותו סיכון.`,
      urgency: 'high',
      financialImpact: `₪${dup.estimatedMonthlyWaste}/חודש אפשרי לחסוך`,
      confidenceScore: 90,
    });
  }

  for (const missing of analysisResult.missingCoverage || []) {
    recs.push({
      type: `missing_${missing}`,
      title: `כיסוי חסר — ${missing}`,
      reason: `לפי הפרופיל שלך, ביטוח ${missing} מומלץ.`,
      urgency: analysisResult.missingUrgency,
      financialImpact: null,
      confidenceScore: 75,
    });
  }

  return recs;
}

module.exports = {
  getInsuranceProfile,
  analyzeInsuranceCoverage,
  generateInsuranceRecommendations,
};
