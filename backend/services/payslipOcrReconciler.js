/* eslint-disable no-restricted-syntax, no-param-reassign */

/**
 * Deterministic reconciliation layer over the candidate store produced by
 * `collectCoreFieldCandidates`. Penalises (or rejects) candidates that fail
 * cross-field arithmetic and rate-sanity constraints, so that the existing
 * resolvers pick a self-consistent set instead of the highest-score outlier.
 *
 * Designed to be inserted between `collectCoreFieldCandidates` and the
 * `resolve*` calls in payslipOcr.js. Does not change the public API of
 * payslipOcrResolver.js — existing tests remain valid.
 *
 * @module payslipOcrReconciler
 */

const SCORE_FLOOR = 0.01;
const SCORE_CEIL = 1;
const NET_ROUNDING_SLACK = 1.005;

/**
 * Plausible rate ranges (value / gross_total) for the core deductions, based
 * on Israeli payroll regulations and a generous buffer for edge cases.
 */
// Ranges accept low-income/exempt cases (e.g. health ≈ 1.8%) while still
// rejecting label-collision artefacts like "קוד ב.לאומי 9" → 9/4000 ≈ 0.22%.
const RATE_RANGES = Object.freeze({
  national_insurance: { min: 0.003, max: 0.13 },
  health_insurance: { min: 0.012, max: 0.06 },
  income_tax: { min: 0, max: 0.5 },
  mandatory_total: { min: 0.005, max: 0.45 },
});

const RATE_PENALTY = 0.6;
const ARITHMETIC_PENALTY = 0.65;
const COMPONENT_MATCH_BOOST = 0.15;
const COMPONENT_MISMATCH_PENALTY = 0.3;
const NET_SMALLER_BOOST = 0.12;
const NET_LARGER_PENALTY = 0.1;
const NET_LOWER_BOUND_RATIO = 0.4;

function clamp(score) {
  if (!Number.isFinite(score)) return 0;
  return Math.min(SCORE_CEIL, Math.max(SCORE_FLOOR, score));
}

function cloneCandidate(candidate) {
  return { ...candidate };
}

function cloneStore(store) {
  const result = {};
  for (const [field, candidates] of Object.entries(store || {})) {
    result[field] = Array.isArray(candidates) ? candidates.map(cloneCandidate) : candidates;
  }
  return result;
}

function bestByScore(candidates) {
  if (!Array.isArray(candidates) || candidates.length === 0) return undefined;
  let best;
  for (const candidate of candidates) {
    if (!candidate || !Number.isFinite(candidate.value)) continue;
    if (!best || candidate.score > best.score) best = candidate;
  }
  return best;
}

/**
 * Penalise candidates whose value/gross ratio is outside the plausible range
 * for the field. Catches Malam-style "9.00 (קוד ב.לאומי)" and "265 (סמל)"
 * extractions that pick a code/identifier as the amount.
 */
function applyRateSanity(candidates, field, gross, violations) {
  if (!Array.isArray(candidates) || !Number.isFinite(gross) || gross <= 0) return;
  const range = RATE_RANGES[field];
  if (!range) return;

  for (const candidate of candidates) {
    if (!candidate || !Number.isFinite(candidate.value)) continue;
    const rate = candidate.value / gross;
    if (rate < range.min || rate > range.max) {
      candidate.score = clamp(candidate.score - RATE_PENALTY);
      violations.push({
        field,
        rule: 'rate_sanity',
        value: candidate.value,
        gross,
        rate: Number(rate.toFixed(4)),
        allowed: range,
        source: candidate.source,
      });
    }
  }
}

/**
 * Boost mandatory_total candidates that are close to Σ(components), penalise
 * those wildly inconsistent. Fixes the Malam case where mandatory_total
 * resolves to the gross amount.
 */
function biasMandatoryTowardComponentSum(candidates, components, violations) {
  if (!Array.isArray(candidates) || !components || components.length === 0) return;
  const validParts = components.filter(value => Number.isFinite(value) && value >= 0);
  if (validParts.length === 0) return;
  const sum = validParts.reduce((acc, value) => acc + value, 0);
  if (sum <= 0) return;

  for (const candidate of candidates) {
    if (!candidate || !Number.isFinite(candidate.value) || candidate.value <= 0) continue;
    const ratio = Math.abs(candidate.value - sum) / sum;
    if (ratio <= 0.05) {
      candidate.score = clamp(candidate.score + COMPONENT_MATCH_BOOST);
    } else if (ratio >= 0.5) {
      candidate.score = clamp(candidate.score - COMPONENT_MISMATCH_PENALTY);
      violations.push({
        field: 'mandatory_total',
        rule: 'component_sum_mismatch',
        value: candidate.value,
        component_sum: Number(sum.toFixed(2)),
        ratio: Number(ratio.toFixed(3)),
        source: candidate.source,
      });
    }
  }
}

/**
 * Reject net candidates that exceed gross - mandatory (net must come AFTER
 * deductions). Boost the smaller candidate when multiple net values pass —
 * handles "שכר נטו" (pre-voluntary) vs "לתשלום" (post-voluntary), where the
 * smaller value is the actual amount to bank.
 */
function applyNetArithmetic(candidates, gross, mandatory, violations) {
  if (!Array.isArray(candidates)) return;
  if (!Number.isFinite(gross) || gross <= 0) return;
  if (!Number.isFinite(mandatory) || mandatory < 0) return;

  const upperBound = gross - mandatory;
  const slack = upperBound * NET_ROUNDING_SLACK;

  for (const candidate of candidates) {
    if (!candidate || !Number.isFinite(candidate.value)) continue;
    if (candidate.value > slack) {
      candidate.score = clamp(candidate.score - ARITHMETIC_PENALTY);
      violations.push({
        field: 'net_payable',
        rule: 'exceeds_gross_minus_mandatory',
        value: candidate.value,
        upper_bound: Number(upperBound.toFixed(2)),
        source: candidate.source,
      });
    }
  }

  // Prefer the smaller value among multiple net candidates that are within
  // a tight band of the upper bound (typical שכר נטו vs לתשלום situation).
  const lowerBound = upperBound * NET_LOWER_BOUND_RATIO;
  const inBand = candidates.filter(c => Number.isFinite(c?.value)
    && c.value <= slack
    && c.value >= lowerBound);
  if (inBand.length < 2) return;

  const minValue = Math.min(...inBand.map(c => c.value));
  const maxValue = Math.max(...inBand.map(c => c.value));
  const spread = (maxValue - minValue) / maxValue;
  if (spread < 0.005) return;

  for (const candidate of inBand) {
    const distFromMin = Math.abs(candidate.value - minValue) / Math.max(minValue, 1);
    if (distFromMin < 0.005) {
      candidate.score = clamp(candidate.score + NET_SMALLER_BOOST);
    } else if (candidate.value > minValue * 1.01) {
      candidate.score = clamp(candidate.score - NET_LARGER_PENALTY);
    }
  }
}

/**
 * Run the full reconciliation pass over a core-field candidate store.
 *
 * @param {Object} store - Output of `collectCoreFieldCandidates`.
 * @returns {{ refined: Object, violations: Array, debug: Object }}
 *   - `refined`: deep-cloned store with scores adjusted in place. The caller
 *     can pass `refined.<field>` straight to `resolveBestNumericCandidate`.
 *   - `violations`: structured list of rejected/penalised candidates.
 *   - `debug`: chosen reconciled values for trace logs.
 */
function reconcileCoreCandidates(store) {
  const refined = cloneStore(store);
  const violations = [];

  const gross = bestByScore(refined.gross_total);
  if (!gross) {
    return {
      refined,
      violations: [{ rule: 'no_gross_resolved', field: 'gross_total' }],
      debug: { gross_total: null },
    };
  }

  applyRateSanity(refined.national_insurance, 'national_insurance', gross.value, violations);
  applyRateSanity(refined.health_insurance, 'health_insurance', gross.value, violations);
  applyRateSanity(refined.income_tax, 'income_tax', gross.value, violations);
  applyRateSanity(refined.mandatory_total, 'mandatory_total', gross.value, violations);

  const ni = bestByScore(refined.national_insurance);
  const health = bestByScore(refined.health_insurance);
  const tax = bestByScore(refined.income_tax);

  const componentValues = [ni?.value, health?.value, tax?.value].filter(Number.isFinite);
  biasMandatoryTowardComponentSum(refined.mandatory_total, componentValues, violations);

  const mandatory = bestByScore(refined.mandatory_total);
  const mandatoryValue = mandatory?.value
    ?? (componentValues.length > 0 ? componentValues.reduce((a, b) => a + b, 0) : 0);

  applyNetArithmetic(refined.net_payable, gross.value, mandatoryValue, violations);

  return {
    refined,
    violations,
    debug: {
      gross_total: gross.value,
      national_insurance: ni?.value ?? null,
      health_insurance: health?.value ?? null,
      income_tax: tax?.value ?? null,
      mandatory_total: mandatoryValue,
      component_sum: componentValues.length > 0
        ? Number(componentValues.reduce((a, b) => a + b, 0).toFixed(2))
        : null,
    },
  };
}

module.exports = {
  reconcileCoreCandidates,
  RATE_RANGES,
  // Exported for unit tests:
  _internal: {
    applyRateSanity,
    biasMandatoryTowardComponentSum,
    applyNetArithmetic,
    bestByScore,
    clamp,
  },
};
