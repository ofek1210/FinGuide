/**
 * Unified insurance analysis — reused by API and upload response.
 */



const InsurancePolicy = require('../models/InsurancePolicy');
const PensionFund = require('../models/PensionFund');
const {
  getInsuranceProfile,
  analyzeInsuranceCoverage,
  generateInsuranceRecommendations,
} = require('../ai/tools/insuranceTools');
const { runInsuranceHealthCheck } = require('./insuranceHealthCheckService');
const { buildMarketAdvice } = require('./insuranceMarketAdvisorService');
const { buildBituahMarketAdvice } = require('./bituahNetAdvisorService');

function buildInsuranceDataSources(pensionFunds, dbPolicies) {
  const coverages = [];
  for (const fund of pensionFunds) {
    for (const cov of fund.insuranceCoverages || []) {
      coverages.push({
        fundId: fund._id.toString(),
        fundName: fund.fundName,
        provider: fund.provider ?? null,
        coverageType: cov.coverageType || cov.type || 'כיסוי',
        monthlyPremium: cov.monthlyPremium ?? cov.monthlyCost ?? null,
        coverageAmount: cov.coverageAmount ?? cov.sumInsured ?? null,
        source: 'clearinghouse',
      });
    }
  }

  const hasClearinghouseImport = pensionFunds.some(
    f => f.source === 'clearinghouse' || (f.insuranceCoverages?.length ?? 0) > 0,
  );

  return {
    clearinghouse: {
      status: coverages.length > 0 ? 'ready' : hasClearinghouseImport ? 'empty' : 'missing',
      labelHe: 'דוח המסלקה הפנסיונית',
      coverageCount: coverages.length,
      coverages,
    },
    harHabituach: {
      status: dbPolicies.length > 0 ? 'ready' : 'missing',
      labelHe: 'דוח הר הביטוח',
      policyCount: dbPolicies.length,
    },
  };
}

async function buildInsuranceAnalysis(userId) {
  const profileDTO = await getInsuranceProfile(userId);
  const dbPolicies = await InsurancePolicy.find({ user: userId, status: { $ne: 'cancelled' } })
    .select('+rawData')
    .lean();

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
      rawData: p.rawData,
      notes: p.notes,
    }));
  }

  const pensionFunds = await PensionFund.find({ user: userId }).lean();
  const analysis = analyzeInsuranceCoverage(profileDTO, { pensionFunds });
  const policiesForDisplay = analysis.aggregatedPolicies || profileDTO.policies;

  const marketAdvice = await buildMarketAdvice(policiesForDisplay, profileDTO, { analysis });
  const recommendations = generateInsuranceRecommendations(analysis, marketAdvice);
  const healthCheck = runInsuranceHealthCheck(profileDTO, { ...analysis, policies: policiesForDisplay });
  const bituahAdvice = await buildBituahMarketAdvice(policiesForDisplay, profileDTO);

  const bituahRecs = (bituahAdvice.funds || [])
    .filter(f => f.verdict !== 'LEAVE')
    .map(f => ({
      type: 'bituah_track',
      title: `מסלול השקעה — ${f.verdictLabelHe}`,
      reason: f.summaryHe,
      urgency: f.verdict === 'SWITCH' ? 'high' : 'medium',
      financialImpact: f.annualSavingsEstimate
        ? `~₪${f.annualSavingsEstimate.toLocaleString('he-IL')}/שנה`
        : null,
      confidenceScore: 0.76,
    }));

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
    recommendations: [...bituahRecs, ...recommendations],
    marketAdvice,
    bituahAdvice,
    hasImportedPolicies: dbPolicies.length > 0,
    dataSources: buildInsuranceDataSources(pensionFunds, dbPolicies),
  };
}

module.exports = { buildInsuranceAnalysis };
