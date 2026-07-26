'use strict';

const { COVERAGE_FAMILIES, isVehicleFamily } = require('./insuranceCoverageTaxonomy');

function normalizeProvider(value) {
  return String(value ?? '').trim().toLowerCase().replace(/[.\-]/g, '');
}

function dateKey(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function vehicleFamiliesForPolicy(policy) {
  return (policy.premiumBreakdown || [])
    .flatMap(b => b.coverageFamilies || [b.coverageType])
    .filter(f => isVehicleFamily(f));
}

function isVehiclePolicy(policy) {
  return policy.policyType === 'car' || vehicleFamiliesForPolicy(policy).length > 0;
}

function packageConfidenceForPolicies(policies) {
  const families = new Set(policies.flatMap(p => vehicleFamiliesForPolicy(p)));
  const hasCompulsory = families.has(COVERAGE_FAMILIES.VEHICLE_COMPULSORY);
  const hasComprehensive = families.has(COVERAGE_FAMILIES.VEHICLE_COMPREHENSIVE);
  if (hasCompulsory && hasComprehensive) return 'probable';
  if (policies.length === 1 && families.size >= 2) return 'probable';
  if (policies.length > 1) return 'uncertain';
  return 'uncertain';
}

/**
 * Group vehicle policies into probable packages (compulsory + comprehensive may belong together).
 */
function groupProbableVehiclePackages(normalizedPolicies) {
  const vehiclePolicies = (normalizedPolicies || []).filter(isVehiclePolicy);
  const groups = [];
  const used = new Set();

  for (const policy of vehiclePolicies) {
    if (used.has(policy.policyId)) continue;

    if (policy.licensePlate) {
      const plateGroup = vehiclePolicies.filter(p =>
        p.licensePlate && p.licensePlate === policy.licensePlate,
      );
      plateGroup.forEach(p => used.add(p.policyId));
      groups.push({
        groupId: `plate:${policy.licensePlate}`,
        confidence: 'confirmed',
        policyIds: plateGroup.map(p => p.policyId),
        insurer: policy.insurer,
        licensePlate: policy.licensePlate,
        reasons: ['מספר רישוי זהה'],
      });
      continue;
    }

    const insurer = normalizeProvider(policy.insurer);
    const start = dateKey(policy.startDate);
    const candidates = vehiclePolicies.filter(p => {
      if (used.has(p.policyId)) return false;
      if (normalizeProvider(p.insurer) !== insurer) return false;
      const pStart = dateKey(p.startDate);
      if (start && pStart && start !== pStart) return false;
      return true;
    });

    if (candidates.length <= 1) {
      used.add(policy.policyId);
      const confidence = packageConfidenceForPolicies(candidates);
      groups.push({
        groupId: `singleton:${policy.policyId}`,
        confidence,
        policyIds: candidates.map(p => p.policyId),
        insurer: policy.insurer,
        licensePlate: null,
        reasons: confidence === 'probable'
          ? ['חובה ומקיף באותה פוליסה — חבילת רכב אפשרית']
          : ['פוליסת רכב בודדת — לא ניתן לאשר חבילה'],
      });
      continue;
    }

    candidates.forEach(p => used.add(p.policyId));
    const confidence = packageConfidenceForPolicies(candidates);
    groups.push({
      groupId: `pkg:${insurer}:${start || policy.policyId}`,
      confidence,
      policyIds: candidates.map(p => p.policyId),
      insurer: policy.insurer,
      licensePlate: null,
      reasons: [
        'אותה חברה',
        start ? `תאריכי כיסוי תואמים (${start})` : 'תאריכי כיסוי דומים',
        confidence === 'probable' ? 'חובה ומקיף — חבילת רכב אפשרית' : 'מספר פוליסות רכב',
      ],
    });
  }

  return groups;
}

module.exports = {
  groupProbableVehiclePackages,
  isVehiclePolicy,
};
