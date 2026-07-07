/**
 * Unified insurance analysis — reused by API and upload response.
 */



const InsurancePolicy = require('../models/InsurancePolicy');
const {
  getInsuranceProfile,
  analyzeInsuranceCoverage,
  generateInsuranceRecommendations,
} = require('../ai/tools/insuranceTools');
const { runInsuranceHealthCheck } = require('./insuranceHealthCheckService');
const { buildMarketAdvice } = require('./insuranceMarketAdvisorService');

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
  const policiesForDisplay = analysis.aggregatedPolicies || profileDTO.policies;
  const healthCheck = runInsuranceHealthCheck(profileDTO, { ...analysis, policies: policiesForDisplay });
  const recommendations = generateInsuranceRecommendations(analysis);

  const marketAdvice = await buildMarketAdvice(policiesForDisplay, profileDTO);

  return {
    summary: {
      hasData: dbPolicies.length > 0 || profileDTO.hasProfile,
      policyCount: policiesForDisplay.length,
      rawRowCount: profileDTO.policies.length,
      totalMonthlyPremium: policiesForDisplay.reduce((s, p) => s + (p.monthlyPremium || 0), 0),
      aggregation: analysis.aggregationSummary,
    },
    profile: profileDTO.profile,
    personal: profileDTO.personal,
    assets: profileDTO.assets,
    policies: policiesForDisplay,
    analysis,
    healthCheck,
    recommendations,
    marketAdvice,
    hasImportedPolicies: dbPolicies.length > 0,
  };
}

module.exports = { buildInsuranceAnalysis };
