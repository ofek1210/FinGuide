

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

/**
 * Detect true cross-policy duplications (different policy numbers, same risk type).
 * @param {object[]} aggregatedPolicies - output of aggregatePoliciesByPolicyNumber
 * @param {object} [options]
 * @param {boolean} [options.hasKupatHolimSupplement] - user has Shaban-style coverage
 */
function detectTruePolicyDuplications(aggregatedPolicies, { hasKupatHolimSupplement = true } = {}) {
  const byRisk = new Map();

  for (const policy of aggregatedPolicies || []) {
    const policyKey = policy.aggregationKey
      || policyGroupKey(policy.provider, policy.policyNumber)
      || `singleton::${policy.id || policy.provider || 'unknown'}`;

    const riskTypes = policy.riskTypes?.length
      ? policy.riskTypes
      : inferRiskTypes(policy);

    for (const riskType of riskTypes) {
      if (!byRisk.has(riskType)) byRisk.set(riskType, new Map());
      const bucket = byRisk.get(riskType);

      if (!bucket.has(policyKey)) {
        bucket.set(policyKey, {
          policyKey,
          provider: policy.provider,
          policyNumber: policy.policyNumber,
          policyId: policy.id,
          monthlyPremium: policy.monthlyPremium || 0,
          isCatastrophic: CATASTROPHIC_IDS.has(riskType),
          kupatHolimOverlap: KUPAT_HOLIM_OVERLAP_IDS.has(riskType),
          riders: policy.riders || [],
        });
      }
    }
  }

  const duplicates = [];
  let totalWaste = 0;

  for (const [riskType, policyMap] of byRisk.entries()) {
    const entries = [...policyMap.values()];
    if (entries.length < 2) continue;

    const isCatastrophic = CATASTROPHIC_IDS.has(riskType);
    const isKupatHolimOverlap = KUPAT_HOLIM_OVERLAP_IDS.has(riskType);

    const sorted = [...entries].sort((a, b) => (a.monthlyPremium || 0) - (b.monthlyPremium || 0));
    let waste = sorted.slice(1).reduce((sum, p) => sum + (p.monthlyPremium || 0), 0);

    if (isKupatHolimOverlap && hasKupatHolimSupplement && waste === 0) {
      waste = DEFAULT_REDUNDANT_WASTE;
    }

    duplicates.push({
      type: riskType,
      typeLabelHe: riskTypeLabelHe(riskType),
      policies: entries.map(e => ({
        provider: e.provider,
        policyNumber: e.policyNumber,
        policyId: e.policyId,
        monthlyPremium: e.monthlyPremium,
      })),
      policyCount: entries.length,
      estimatedMonthlyWaste: Math.round(waste),
      isCatastrophic,
      kupatHolimOverlap: isKupatHolimOverlap,
      recommendCancellation: !isCatastrophic,
      reasonHe: buildDuplicateReasonHe(riskType, entries, isCatastrophic, isKupatHolimOverlap),
    });

    totalWaste += waste;
  }

  return {
    duplicates,
    totalWaste: Math.round(totalWaste),
    duplicateCount: duplicates.length,
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
  const cancellableDuplicates = (duplicateResult.duplicates || []).filter(d => d.recommendCancellation);
  const redundantDuplications = cancellableDuplicates.length;
  const cancellableWaste = cancellableDuplicates.reduce((s, d) => s + (d.estimatedMonthlyWaste || 0), 0);
  const catastrophicRiders = aggregatedPolicies.reduce(
    (sum, p) => sum + (p.riders || []).filter(r => r.isCatastrophic).length,
    0,
  );

  let status = 'optimized';
  let statusHe = 'כיסוי ליבה מאופטם';
  if (redundantDuplications > 0) {
    status = 'review_duplicates';
    statusHe = `זוהו ${redundantDuplications} כפילויות אמיתיות בין פוליסות`;
  } else if (rawCount > policyCount) {
    status = 'optimized';
    statusHe = `סה"כ פוליסות: ${policyCount}. כפילויות מיותרות: 0. סטטוס: כיסוי ליבה מאופטם (${rawCount} נספחים אוחדו)`;
  }

  return {
    totalRawRows: rawCount,
    totalPolicies: policyCount,
    consolidatedRiderGroups: aggregatedPolicies.filter(p => p.isConsolidated).length,
    redundantDuplications,
    crossPolicyOverlaps: (duplicateResult.duplicates || []).length - redundantDuplications,
    cancellableMonthlyWaste: Math.round(cancellableWaste),
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
    aggregationSummary: summary,
    duplicates: duplicateResult.duplicates,
    duplicateCount: duplicateResult.duplicateCount,
    totalMonthlyWaste: duplicateResult.totalWaste,
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
