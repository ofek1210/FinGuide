/**
 * Unified insurance analysis — reused by API and upload response.
 */
'use strict';

const InsurancePolicy = require('../models/InsurancePolicy');
const {
  getInsuranceProfile,
  analyzeInsuranceCoverage,
  generateInsuranceRecommendations,
} = require('../ai/tools/insuranceTools');
const { runInsuranceHealthCheck } = require('./insuranceHealthCheckService');

async function buildInsuranceAnalysis(userId) {
  const profileDTO = await getInsuranceProfile(userId);
  const dbPolicies = await InsurancePolicy.find({ user: userId, status: { $ne: 'cancelled' } }).lean();

  if (dbPolicies.length > 0) {
    profileDTO.policies = dbPolicies.map(p => ({
      id: p._id.toString(),
      type: p.type,
      provider: p.provider,
      policyNumber: p.policyNumber,
      monthlyPremium: p.monthlyPremium,
      coverageAmount: p.coverageAmount,
      startDate: p.startDate,
      endDate: p.endDate,
      status: p.status,
    }));
  }

  const analysis = analyzeInsuranceCoverage(profileDTO);
  const healthCheck = runInsuranceHealthCheck(profileDTO, analysis);
  const recommendations = generateInsuranceRecommendations(analysis);

  return {
    summary: {
      hasData: dbPolicies.length > 0 || profileDTO.hasProfile,
      policyCount: profileDTO.policies.length,
      totalMonthlyPremium: profileDTO.policies.reduce((s, p) => s + (p.monthlyPremium || 0), 0),
    },
    profile: profileDTO.profile,
    personal: profileDTO.personal,
    assets: profileDTO.assets,
    policies: profileDTO.policies,
    analysis,
    healthCheck,
    recommendations,
    hasImportedPolicies: dbPolicies.length > 0,
  };
}

module.exports = { buildInsuranceAnalysis };
