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
const { buildMarketAdvice } = require('./insuranceMarketAdvisorService');
const { buildBituahMarketAdvice } = require('./bituahNetAdvisorService');
const {
  buildInsuranceDecision,
  decisionToHealthCheck,
} = require('./insurance/insuranceDecisionEngine');

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
  const decision = buildInsuranceDecision(
    profileDTO,
    analysis,
    marketAdvice,
    { policies: policiesForDisplay },
  );
  const healthCheck = decisionToHealthCheck(decision, analysis);

  // Prefer executive actions as advisor-style recommendations (max 5).
  const actionRecs = decision.executiveActions.map(a => ({
    type: a.id,
    title: a.titleHe,
    reason: a.reasonHe,
    urgency: a.priority,
    financialImpact: null,
    confidenceScore: a.priority === 'high' ? 0.85 : a.priority === 'medium' ? 0.7 : 0.55,
    nextActionHe: a.expectedBenefitHe,
    evidence: a.evidence,
    expectedBenefitHe: a.expectedBenefitHe,
  }));

  const fallbackRecs = generateInsuranceRecommendations(analysis, marketAdvice);
  const recommendations = actionRecs.length ? actionRecs : fallbackRecs.slice(0, 5);

  const bituahAdvice = await buildBituahMarketAdvice(policiesForDisplay, profileDTO);

  return {
    summary: {
      hasData: dbPolicies.length > 0 || profileDTO.hasProfile,
      policyCount: policiesForDisplay.length,
      rawRowCount: profileDTO.policies.length,
      totalMonthlyPremium: policiesForDisplay.reduce((s, p) => s + (p.monthlyPremium || 0), 0),
      aggregation: analysis.aggregationSummary,
      decisionStatus: decision.status,
      healthScore: decision.healthScore,
    },
    profile: profileDTO.profile,
    personal: profileDTO.personal,
    assets: profileDTO.assets,
    policies: policiesForDisplay,
    analysis,
    decision,
    healthCheck,
    recommendations,
    marketAdvice: {
      ...marketAdvice,
      coverageSummaries: decision.coverageCompleteness,
      companyQuality: {
        ...marketAdvice.companyQuality,
        insurers: decision.companyQuality.insurers,
      },
    },
    bituahAdvice,
    hasImportedPolicies: dbPolicies.length > 0,
    dataSources: buildInsuranceDataSources(pensionFunds, dbPolicies),
  };
}

module.exports = { buildInsuranceAnalysis };
