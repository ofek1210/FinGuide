/**
 * Monthly price ranges (ILS) for Israeli insurance products, 2026 estimates.
 * Used by the deterministic recommender — not personalized quotes.
 */

const BASE = {
  life: { min: 40, average: 120, max: 350 },
  health: { min: 80, average: 220, max: 600 },
  disability: { min: 60, average: 180, max: 450 },
  apartment: { min: 35, average: 90, max: 200 },
  car: { min: 150, average: 350, max: 900 },
  pension_increase: { min: 0, average: 0, max: 0 },
};

function ageMultiplier(age) {
  if (age == null) return 1;
  if (age < 30) return 0.85;
  if (age < 40) return 1;
  if (age < 50) return 1.25;
  if (age < 60) return 1.6;
  return 2.2;
}

function salaryMultiplier(grossMonthly) {
  if (grossMonthly == null) return 1;
  if (grossMonthly < 10000) return 0.9;
  if (grossMonthly < 20000) return 1;
  if (grossMonthly < 35000) return 1.15;
  return 1.3;
}

function scaleRange(base, multiplier) {
  return {
    min: Math.round(base.min * multiplier),
    average: Math.round(base.average * multiplier),
    max: Math.round(base.max * multiplier),
    currency: 'ILS',
  };
}

function getPriceRange(kind, { age, grossMonthly, childrenCount } = {}) {
  const base = BASE[kind];
  if (!base) return { min: 0, average: 0, max: 0, currency: 'ILS' };

  let multiplier = ageMultiplier(age) * salaryMultiplier(grossMonthly);
  if (kind === 'life' && childrenCount > 0) {
    multiplier *= 1 + childrenCount * 0.15;
  }
  if (kind === 'apartment') {
    multiplier *= 1.1;
  }

  return scaleRange(base, multiplier);
}

module.exports = { BASE, getPriceRange, ageMultiplier, salaryMultiplier };
