const {
  reconcileCoreCandidates,
  RATE_RANGES,
  _internal: {
    applyRateSanity,
    biasMandatoryTowardComponentSum,
    applyNetArithmetic,
    bestByScore,
    clamp,
  },
} = require('../../services/payslipOcrReconciler');

const buildCandidate = (value, score = 0.8, extra = {}) => ({
  field: extra.field || null,
  value,
  source: extra.source || 'label_same_line',
  score,
  reason: extra.reason || null,
  lineIndex: null,
  section: null,
  evidenceCategory: 'label',
  ...extra,
});

describe('payslipOcrReconciler — helpers', () => {
  it('clamp keeps scores within [SCORE_FLOOR, 1]', () => {
    expect(clamp(2)).toBe(1);
    expect(clamp(-1)).toBe(0.01);
    expect(clamp(0.5)).toBe(0.5);
    expect(clamp(Number.NaN)).toBe(0);
  });

  it('bestByScore picks the highest-scoring valid candidate', () => {
    const candidates = [
      buildCandidate(100, 0.5),
      buildCandidate(200, 0.9),
      buildCandidate(Number.NaN, 0.99),
    ];
    const best = bestByScore(candidates);
    expect(best.value).toBe(200);
    expect(best.score).toBe(0.9);
  });

  it('bestByScore returns undefined for empty/invalid input', () => {
    expect(bestByScore([])).toBeUndefined();
    expect(bestByScore(null)).toBeUndefined();
    expect(bestByScore([{ value: Number.NaN, score: 1 }])).toBeUndefined();
  });
});

describe('payslipOcrReconciler — applyRateSanity', () => {
  it('penalises label-collision artefacts (NI=9 with gross=4000)', () => {
    const candidates = [
      buildCandidate(9, 0.95),       // label-collision: "קוד ב.לאומי 9"
      buildCandidate(42.35, 0.7),    // real NI value
    ];
    const violations = [];
    applyRateSanity(candidates, 'national_insurance', 4000, violations);
    expect(candidates[0].score).toBeLessThan(0.5);
    expect(candidates[1].score).toBe(0.7);
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe('rate_sanity');
  });

  it('keeps in-range candidates untouched', () => {
    const candidates = [buildCandidate(120, 0.8)];
    const violations = [];
    applyRateSanity(candidates, 'health_insurance', 6000, violations);
    expect(candidates[0].score).toBe(0.8);
    expect(violations).toHaveLength(0);
  });

  it('is a no-op for unknown field or zero gross', () => {
    const candidates = [buildCandidate(100, 0.8)];
    applyRateSanity(candidates, 'unknown_field', 5000, []);
    applyRateSanity(candidates, 'national_insurance', 0, []);
    expect(candidates[0].score).toBe(0.8);
  });
});

describe('payslipOcrReconciler — biasMandatoryTowardComponentSum', () => {
  it('boosts mandatory candidate close to Σcomponents', () => {
    const candidates = [
      buildCandidate(173.88, 0.7),   // expected: ni+health+tax = 173.88
      buildCandidate(536.72, 0.85),  // wildly off
    ];
    const components = [42.35, 131.53, 0];
    const violations = [];
    biasMandatoryTowardComponentSum(candidates, components, violations);
    expect(candidates[0].score).toBeGreaterThan(0.7);
    expect(candidates[1].score).toBeLessThan(0.85);
    expect(violations.some(v => v.rule === 'component_sum_mismatch')).toBe(true);
  });

  it('does nothing when components have no positive values', () => {
    const candidates = [buildCandidate(100, 0.7)];
    biasMandatoryTowardComponentSum(candidates, [0, 0, 0], []);
    expect(candidates[0].score).toBe(0.7);
  });
});

describe('payslipOcrReconciler — applyNetArithmetic', () => {
  it('rejects net candidates exceeding gross − mandatory', () => {
    const candidates = [
      buildCandidate(17000, 0.9),   // net > gross — must reject
      buildCandidate(10000, 0.85),  // valid
    ];
    const violations = [];
    applyNetArithmetic(candidates, 15000, 2000, violations);
    expect(candidates[0].score).toBeLessThan(0.4);
    expect(candidates[1].score).toBeGreaterThanOrEqual(0.85);
    expect(violations.some(v => v.rule === 'exceeds_gross_minus_mandatory')).toBe(true);
  });

  it('boosts smaller net candidate when multiple valid (שכר נטו vs לתשלום)', () => {
    // michpal-202209 scenario: gross=6504.40, mandatory=567.55
    // gross - mandatory = 5936.85 (= שכר נטו pre-voluntary)
    // לתשלום = 5636.85 (after 300 voluntary deductions) — the correct net
    const candidates = [
      buildCandidate(5936.85, 0.92, { source: 'label_same_line' }), // שכר נטו
      buildCandidate(5636.85, 0.88, { source: 'label_same_line' }), // לתשלום
    ];
    applyNetArithmetic(candidates, 6504.40, 567.55, []);
    // Smaller value should outrank larger after the bias.
    const smaller = candidates.find(c => c.value === 5636.85);
    const larger = candidates.find(c => c.value === 5936.85);
    expect(smaller.score).toBeGreaterThan(larger.score);
  });

  it('is a no-op when only one net candidate exists', () => {
    const candidates = [buildCandidate(5000, 0.9)];
    applyNetArithmetic(candidates, 6000, 500, []);
    expect(candidates[0].score).toBe(0.9);
  });
});

describe('payslipOcrReconciler — reconcileCoreCandidates (integration)', () => {
  it('produces no-op behaviour when no gross can be resolved', () => {
    const store = { national_insurance: [buildCandidate(100, 0.5)] };
    const result = reconcileCoreCandidates(store);
    expect(result.violations[0].rule).toBe('no_gross_resolved');
    expect(result.refined.national_insurance[0].score).toBe(0.5);
  });

  it('does not mutate the original store', () => {
    const store = {
      gross_total: [buildCandidate(4000, 0.95)],
      national_insurance: [buildCandidate(9, 0.9)],
    };
    const snapshot = JSON.stringify(store);
    reconcileCoreCandidates(store);
    expect(JSON.stringify(store)).toBe(snapshot);
  });

  it('exposes resolved values in debug for trace logs', () => {
    const store = {
      gross_total: [buildCandidate(4072.05, 0.98)],
      national_insurance: [buildCandidate(42.35, 0.7)],
      health_insurance: [buildCandidate(131.53, 0.7)],
      income_tax: [],
      mandatory_total: [buildCandidate(173.88, 0.7)],
      net_payable: [buildCandidate(3666.51, 0.8)],
    };
    const { debug } = reconcileCoreCandidates(store);
    expect(debug.gross_total).toBe(4072.05);
    expect(debug.national_insurance).toBe(42.35);
    expect(debug.component_sum).toBeCloseTo(173.88, 2);
  });

  it('exports rate ranges for documentation/inspection', () => {
    expect(RATE_RANGES.national_insurance).toEqual({ min: 0.003, max: 0.13 });
    expect(RATE_RANGES.health_insurance.min).toBeGreaterThan(0);
  });
});
