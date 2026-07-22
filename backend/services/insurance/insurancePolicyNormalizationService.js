'use strict';

const { classifyCoverageFamilies, COVERAGE_FAMILIES, isVehicleFamily } = require('./insuranceCoverageTaxonomy');

function normalizeProvider(value) {
  return String(value ?? '').trim().toLowerCase().replace(/[.\-]/g, '');
}

function policyGroupKey(provider, policyNumber) {
  const p = normalizeProvider(provider);
  const n = String(policyNumber ?? '').trim().toLowerCase().replace(/\s/g, '');
  if (p && n) return `${p}::${n}`;
  return null;
}

/**
 * Convert aggregated Har HaBituach policies into normalized policy contracts.
 * @param {object[]} aggregatedPolicies - from aggregatePoliciesByPolicyNumber
 * @returns {object[]} NormalizedInsurancePolicy[]
 */
function normalizeInsurancePolicies(aggregatedPolicies) {
  return (aggregatedPolicies || []).map(policy => {
    const riders = policy.riders?.length
      ? policy.riders
      : [{ label: policy.type || 'כיסוי', monthlyPremium: policy.monthlyPremium ?? 0, riskTypes: policy.riskTypes || [] }];

    const premiumBreakdown = riders.map(rider => {
      const families = classifyCoverageFamilies(policy, rider.label);
      return {
        coverageType: families[0] || 'unknown',
        coverageFamilies: families,
        label: rider.label,
        premiumMonthly: rider.monthlyPremium ?? 0,
      };
    });

    const productTypes = [...new Set(premiumBreakdown.flatMap(b => b.coverageFamilies))];
    const secondaryCoverages = premiumBreakdown.map(b => b.label).filter(Boolean);

    const raw = policy.rawData || {};
    return {
      policyId: policy.id,
      policyNumber: policy.policyNumber || null,
      insurer: policy.provider || null,
      primaryBranch: raw.mainBranch || policy.type || null,
      secondaryCoverages,
      productTypes,
      premiumMonthly: policy.monthlyPremium ?? premiumBreakdown.reduce((s, b) => s + (b.premiumMonthly || 0), 0),
      premiumBreakdown,
      startDate: policy.startDate ?? null,
      endDate: policy.endDate ?? null,
      classification: raw.classification || raw.planClass || null,
      policyType: policy.type || null,
      sourceRows: policy.rawRows?.map(r => r.id || r._id?.toString?.()).filter(Boolean)
        || (policy.isConsolidated ? [`aggregated:${policy.aggregationKey}`] : [policy.id]),
      licensePlate: raw.licensePlate || raw.vehiclePlate || null,
      aggregationKey: policy.aggregationKey || policyGroupKey(policy.provider, policy.policyNumber),
    };
  });
}

module.exports = {
  normalizeInsurancePolicies,
  policyGroupKey,
};
