

/**
 * Insurance policy aggregation & true-duplication detection.
 *
 * Har HaBituach rows sharing the same [Company + Policy Number] are riders (נספחים)
 * of a single policy — not separate policies. Only different policy numbers covering
 * the same risk type across insurers are flagged as duplicates.
 */

const CATASTROPHIC_RIDER_DEFS = [
  { id: 'drugs_abroad', patterns: ['תרופות מחוץ לסל', 'מחוץ לסל', 'תרופות שלא בסל'] },
  { id: 'transplants', patterns: ['השתלות', 'השתלת'] },
  { id: 'surgery_abroad', patterns: ['ניתוחים בחו"ל', 'ניתוח בחו"ל', 'בחו"ל'] },
];

const KUPAT_HOLIM_OVERLAP_DEFS = [
  { id: 'surgery_israel', patterns: ['ניתוחים בישראל', 'ניתוחים פרטיים', 'השת"פ', 'ניתוח פרטי'] },
];

const OTHER_RISK_DEFS = [
  { id: 'critical_illness', patterns: ['מחלות קשות', 'סרטן'] },
  { id: 'disability', patterns: ['אכ"ע', 'אובדן כושר', 'נכות'] },
  { id: 'life', patterns: ['ביטוח חיים', 'ריסק', 'חיים'] },
  { id: 'health', patterns: ['בריאות', 'שב"ן', 'משלים'] },
  { id: 'car', patterns: ['רכב', 'חובה', 'מקיף'] },
  { id: 'apartment', patterns: ['דירה', 'מבנה', 'תכולה'] },
];

const CATASTROPHIC_IDS = new Set(CATASTROPHIC_RIDER_DEFS.map(d => d.id));
const KUPAT_HOLIM_OVERLAP_IDS = new Set(KUPAT_HOLIM_OVERLAP_DEFS.map(d => d.id));

const DEFAULT_REDUNDANT_WASTE = 40;

function normalizeText(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/["״''`]/g, '"')
    .replace(/\s+/g, ' ');
}

function normalizeProvider(value) {
  return normalizeText(value).replace(/[.\-]/g, '');
}

function policyGroupKey(provider, policyNumber) {
  const p = normalizeProvider(provider);
  const n = normalizeText(policyNumber).replace(/\s/g, '');
  if (p && n) return `${p}::${n}`;
  return null;
}

function policyTextBlob(policy) {
  const raw = policy.rawData || {};
  return [
    policy.type,
    raw.mainBranch,
    raw.subBranch,
    raw.productType,
    raw.planClass,
    raw.extra,
    raw.label,
    policy.notes,
  ].filter(Boolean).join(' ');
}

function matchRiskDef(text, defs) {
  const norm = normalizeText(text);
  for (const def of defs) {
    if (def.patterns.some(p => norm.includes(normalizeText(p)))) {
      return def.id;
    }
  }
  return null;
}

function inferRiskTypes(policy) {
  const blob = policyTextBlob(policy);
  const types = new Set();

  for (const def of [...CATASTROPHIC_RIDER_DEFS, ...KUPAT_HOLIM_OVERLAP_DEFS, ...OTHER_RISK_DEFS]) {
    if (def.patterns.some(p => blob.includes(normalizeText(p)))) {
      types.add(def.id);
    }
  }

  if (types.size === 0 && policy.type) {
    types.add(policy.type === 'critical_illness' ? 'critical_illness' : policy.type);
  }

  return [...types];
}

function extractRiderFromPolicy(policy) {
  const raw = policy.rawData || {};
  const label = raw.subBranch || raw.productType || raw.planClass || raw.extra || policy.type || 'נספח';
  const riskTypes = inferRiskTypes(policy);
  const isCatastrophic = riskTypes.some(t => CATASTROPHIC_IDS.has(t));

  return {
    label,
    riskTypes,
    monthlyPremium: policy.monthlyPremium ?? null,
    isCatastrophic,
    kupatHolimOverlap: riskTypes.some(t => KUPAT_HOLIM_OVERLAP_IDS.has(t)),
  };
}

function resolvePrimaryType(riskTypes, fallbackType) {
  if (riskTypes.includes('life')) return 'life';
  if (riskTypes.includes('disability')) return 'disability';
  if (riskTypes.some(t => CATASTROPHIC_IDS.has(t) || t === 'health' || t === 'critical_illness')) {
    return riskTypes.includes('critical_illness') ? 'critical_illness' : 'health';
  }
  if (riskTypes.includes('car')) return 'car';
  if (riskTypes.includes('apartment')) return 'apartment';
  return fallbackType || 'other';
}

/**
 * Group raw import rows / DB records by [Company + Policy Number].
 * @param {object[]} policies
 * @returns {object[]}
 */
function aggregatePoliciesByPolicyNumber(policies) {
  if (!Array.isArray(policies) || policies.length === 0) return [];

  const groups = new Map();
  const ungrouped = [];

  for (const policy of policies) {
    if (policy.status === 'cancelled' || policy.status === 'expired') continue;

    const key = policyGroupKey(policy.provider, policy.policyNumber);
    if (!key) {
      const rider = extractRiderFromPolicy(policy);
      ungrouped.push({
        ...policy,
        aggregationKey: null,
        riderCount: 1,
        riders: [rider],
        riskTypes: rider.riskTypes,
        hasCatastrophicRiders: rider.isCatastrophic,
        isConsolidated: false,
      });
      continue;
    }

    if (!groups.has(key)) {
      groups.set(key, {
        id: policy.id || policy._id?.toString?.() || key,
        provider: policy.provider,
        policyNumber: policy.policyNumber,
        status: policy.status || 'active',
        sourceFile: policy.sourceFile,
        source: policy.source,
        monthlyPremium: 0,
        annualPremium: 0,
        coverageAmount: policy.coverageAmount ?? null,
        startDate: policy.startDate ?? null,
        endDate: policy.endDate ?? null,
        aggregationKey: key,
        riderCount: 0,
        riders: [],
        riskTypes: [],
        hasCatastrophicRiders: false,
        isConsolidated: false,
        rawRows: [],
      });
    }

    const group = groups.get(key);
    const rider = extractRiderFromPolicy(policy);
    group.riders.push(rider);
    group.riderCount += 1;
    group.monthlyPremium += policy.monthlyPremium || 0;
    group.annualPremium += policy.annualPremium || 0;
    group.rawRows.push(policy);

    for (const rt of rider.riskTypes) {
      if (!group.riskTypes.includes(rt)) group.riskTypes.push(rt);
    }
    if (rider.isCatastrophic) group.hasCatastrophicRiders = true;

    if (policy.coverageAmount != null && group.coverageAmount == null) {
      group.coverageAmount = policy.coverageAmount;
    }
    if (policy.startDate && !group.startDate) group.startDate = policy.startDate;
    if (policy.endDate && !group.endDate) group.endDate = policy.endDate;
  }

  const consolidated = [...groups.values()].map(group => {
    const isConsolidated = group.riderCount > 1;
    const type = resolvePrimaryType(group.riskTypes, group.rawRows[0]?.type);

    return {
      id: group.id,
      type,
      provider: group.provider,
      policyNumber: group.policyNumber,
      monthlyPremium: group.monthlyPremium || null,
      annualPremium: group.annualPremium || null,
      coverageAmount: group.coverageAmount,
      startDate: group.startDate,
      endDate: group.endDate,
      status: group.status,
      sourceFile: group.sourceFile,
      source: group.source,
      aggregationKey: group.aggregationKey,
      riderCount: group.riderCount,
      riders: group.riders,
      riskTypes: group.riskTypes,
      hasCatastrophicRiders: group.hasCatastrophicRiders,
      isConsolidated,
      rawData: {
        aggregated: true,
        riderCount: group.riderCount,
        riders: group.riders,
        rawRowCount: group.riderCount,
      },
    };
  });

  return [...consolidated, ...ungrouped];
}

const { normalizeInsurancePolicies } = require('./insurance/insurancePolicyNormalizationService');
const {
  analyzeDuplicateCoverage,
  mapFindingsToLegacyDuplicates,
} = require('./insurance/insuranceDuplicateEvidenceService');

/**
 * Evidence-based overlap detection — no "cheapest keeper" waste calculation.
 * @param {object[]} aggregatedPolicies - output of aggregatePoliciesByPolicyNumber
 * @param {object} [options]
 * @param {number|null} [options.vehiclesOwned]
 */
function detectTruePolicyDuplications(aggregatedPolicies, options = {}) {
  const normalizedPolicies = normalizeInsurancePolicies(aggregatedPolicies);
  const result = analyzeDuplicateCoverage(normalizedPolicies, options);

  const legacyDuplicates = mapFindingsToLegacyDuplicates(result.findings);

  return {
    duplicates: legacyDuplicates,
    duplicateFindings: result.findings,
    normalizedPolicies,
    vehiclePackages: result.vehiclePackages,
    vehicleVerificationNeeded: result.vehicleVerificationNeeded,
    totalWaste: 0,
    verifiedSavingMonthly: 0,
    premiumUnderReviewMonthly: result.premiumUnderReviewMonthly,
    duplicateCount: legacyDuplicates.length,
  };
}

function riskTypeLabelHe(riskType) {
  const labels = {
    drugs_abroad: 'תרופות מחוץ לסל',
    transplants: 'השתלות',
    surgery_abroad: 'ניתוחים בחו"ל',
    surgery_israel: 'ניתוחים פרטיים בישראל',
    critical_illness: 'מחלות קשות',
    disability: 'אובדן כושר עבודה',
    life: 'ביטוח חיים',
    health: 'בריאות',
    car: 'רכב',
    apartment: 'דירה',
  };
  return labels[riskType] || riskType;
}

function buildDuplicateReasonHe(riskType, entries, isCatastrophic, isKupatHolimOverlap) {
  const providers = [...new Set(entries.map(e => e.provider).filter(Boolean))].join(', ');
  if (isCatastrophic) {
    return `${entries.length} פוליסות נפרדות מכסות ${riskTypeLabelHe(riskType)} (${providers}). זה כפל בין חברות — לא כפל עם קופ"ח.`;
  }
  if (isKupatHolimOverlap) {
    return `כיסוי ${riskTypeLabelHe(riskType)} שעשוי לחפוף לקופת חולים משלים/שaban (${providers}).`;
  }
  return `${entries.length} פוליסות נפרדות מכסות ${riskTypeLabelHe(riskType)} (${providers}).`;
}

function buildAggregationSummary(rawPolicies, aggregatedPolicies, duplicateResult) {
  const rawCount = (rawPolicies || []).filter(p => p.status !== 'cancelled' && p.status !== 'expired').length;
  const policyCount = aggregatedPolicies.length;
  const overlapReviews = duplicateResult.duplicateCount ?? 0;
  const catastrophicRiders = aggregatedPolicies.reduce(
    (sum, p) => sum + (p.riders || []).filter(r => r.isCatastrophic).length,
    0,
  );

  let status = 'optimized';
  let statusHe = 'כיסוי ליבה מאופטם';
  if (duplicateResult.vehicleVerificationNeeded) {
    status = 'needs_vehicle_count';
    statusHe = 'נמצאו מספר פוליסות רכב — השלם כמה רכבים רשומים על שמך';
  } else if (overlapReviews > 0) {
    status = 'review_overlaps';
    statusHe = `נמצאו ${overlapReviews} כיסויים הדורשים בדיקה`;
  } else if (rawCount > policyCount) {
    statusHe = `סה"כ פוליסות: ${policyCount} (${rawCount} שורות מקור אוחדו לפי מספר פוליסה)`;
  }

  return {
    totalRawRows: rawCount,
    totalPolicies: policyCount,
    consolidatedRiderGroups: aggregatedPolicies.filter(p => p.isConsolidated).length,
    redundantDuplications: 0,
    crossPolicyOverlaps: overlapReviews,
    cancellableMonthlyWaste: 0,
    premiumUnderReviewMonthly: duplicateResult.premiumUnderReviewMonthly ?? null,
    vehiclePackageCount: duplicateResult.vehiclePackages?.length ?? null,
    catastrophicRidersProtected: catastrophicRiders,
    status,
    statusHe,
  };
}

/**
 * Full pipeline: aggregate → detect true duplicates → summary.
 */
function analyzeAggregatedInsurance(policies, options = {}) {
  const aggregated = aggregatePoliciesByPolicyNumber(policies);
  const duplicateResult = detectTruePolicyDuplications(aggregated, options);
  const summary = buildAggregationSummary(policies, aggregated, duplicateResult);

  return {
    aggregatedPolicies: aggregated,
    normalizedPolicies: duplicateResult.normalizedPolicies,
    aggregationSummary: summary,
    duplicates: duplicateResult.duplicates,
    duplicateFindings: duplicateResult.duplicateFindings,
    duplicateCount: duplicateResult.duplicateCount,
    vehiclePackages: duplicateResult.vehiclePackages,
    vehicleVerificationNeeded: duplicateResult.vehicleVerificationNeeded,
    totalMonthlyWaste: 0,
    verifiedSavingMonthly: 0,
    premiumUnderReviewMonthly: duplicateResult.premiumUnderReviewMonthly,
  };
}

module.exports = {
  aggregatePoliciesByPolicyNumber,
  aggregateImportPolicies: aggregatePoliciesByPolicyNumber,
  detectTruePolicyDuplications,
  analyzeAggregatedInsurance,
  buildAggregationSummary,
  extractRiderFromPolicy,
  policyGroupKey,
  CATASTROPHIC_IDS,
  KUPAT_HOLIM_OVERLAP_IDS,
};
