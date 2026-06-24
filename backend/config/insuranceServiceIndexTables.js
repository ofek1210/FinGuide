'use strict';

/**
 * Static insurance service index (מדד השירות) — 2024 ISA estimates.
 * claimPaymentRate + satisfactionScore are 0–100.
 * Update from ISA annual service index publication.
 */
const PROVIDERS = [
  { id: 'harel', names: ['הראל', 'harel'], claimPaymentRate: 88, satisfactionScore: 82, serviceIndex: 85 },
  { id: 'clal', names: ['כלל', 'clal'], claimPaymentRate: 85, satisfactionScore: 80, serviceIndex: 83 },
  { id: 'migdal', names: ['מגדל', 'migdal'], claimPaymentRate: 87, satisfactionScore: 84, serviceIndex: 86 },
  { id: 'menora', names: ['מנורה', 'menora'], claimPaymentRate: 86, satisfactionScore: 83, serviceIndex: 84 },
  { id: 'phoenix', names: ['פenix', 'phoenix', 'הפניקס'], claimPaymentRate: 84, satisfactionScore: 81, serviceIndex: 82 },
  { id: 'ayalon', names: ['איילון', 'ayalon'], claimPaymentRate: 83, satisfactionScore: 79, serviceIndex: 81 },
  { id: 'shlomo', names: ['שlomo', 'שlomo'], claimPaymentRate: 82, satisfactionScore: 78, serviceIndex: 80 },
  { id: 'shomera', names: ['שומרה', 'shomera'], claimPaymentRate: 81, satisfactionScore: 77, serviceIndex: 79 },
  { id: 'passportcard', names: ['פספורט-כארד', 'passportcard'], claimPaymentRate: 80, satisfactionScore: 76, serviceIndex: 78 },
  { id: 'direct', names: ['direct', 'דירקט'], claimPaymentRate: 79, satisfactionScore: 75, serviceIndex: 77 },
];

/** Branch-specific adjustments to claim rate (some insurers stronger in car vs health) */
const BRANCH_ADJUSTMENTS = {
  health: { harel: 2, clal: 0, migdal: 1, menora: 1, phoenix: -1 },
  life: { harel: 0, clal: -1, migdal: 1, menora: 0, phoenix: -2 },
  car: { harel: 1, clal: 0, migdal: 2, menora: 0, phoenix: 0 },
  apartment: { harel: 0, clal: 1, migdal: 0, menora: 1, phoenix: 0 },
  disability: { harel: 1, clal: 0, migdal: 1, menora: 0, phoenix: -1 },
};

const MARKET_DEFAULTS = {
  claimPaymentRate: 82,
  satisfactionScore: 78,
  serviceIndex: 80,
};

function normalizeProviderKey(name) {
  return String(name || '').trim().toLowerCase();
}

function matchProvider(name) {
  const key = normalizeProviderKey(name);
  if (!key) return null;
  for (const p of PROVIDERS) {
    if (p.names.some(n => key.includes(normalizeProviderKey(n)))) return p;
  }
  return null;
}

function getServiceScores(providerName, policyType = 'other') {
  const matched = matchProvider(providerName);
  if (!matched) return { ...MARKET_DEFAULTS, providerId: null, matched: false };

  const adj = BRANCH_ADJUSTMENTS[policyType]?.[matched.id] ?? 0;
  const claimPaymentRate = Math.min(100, Math.max(0, matched.claimPaymentRate + adj));
  const satisfactionScore = matched.satisfactionScore;
  const serviceIndex = Math.round((claimPaymentRate * 0.6 + satisfactionScore * 0.4));

  return {
    providerId: matched.id,
    providerName: providerName,
    claimPaymentRate,
    satisfactionScore,
    serviceIndex,
    matched: true,
  };
}

function getTopProvidersByService(limit = 3, policyType = 'health') {
  return PROVIDERS
    .map(p => {
      const scores = getServiceScores(p.names[0], policyType);
      return { ...scores, displayName: p.names[0] };
    })
    .sort((a, b) => b.serviceIndex - a.serviceIndex)
    .slice(0, limit);
}

module.exports = {
  PROVIDERS,
  MARKET_DEFAULTS,
  matchProvider,
  getServiceScores,
  getTopProvidersByService,
};
