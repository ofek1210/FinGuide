'use strict';

const {
  isPayslipPeriodNoise,
  isImplausibleSalaryAmount,
} = require('../../services/payslipOcrShared');
const {
  resolveGrossAndNetCandidates,
} = require('../../services/payslipOcrResolver');
const {
  applySalaryBaselineToCandidates,
  sanitizeResolvedSalaryAgainstBaseline,
  looksLikeCalendarYear,
  median,
} = require('../../services/payslipSalaryBaseline');
const { runPayslipSanityChecks } = require('../../services/payslipSanityChecks');
const {
  _internal: { applyNetArithmetic },
} = require('../../services/payslipOcrReconciler');

describe('agreement-year salary noise (IDF תוספת הסכם 2009)', () => {
  it('treats 2009 on agreement allowance lines as period/year noise', () => {
    expect(isPayslipPeriodNoise(2009, 'תוספת הסכם 2009 793.97')).toBe(true);
    expect(isPayslipPeriodNoise(2009, 'תוספת_הסכם_2009 793.97')).toBe(true);
    expect(isPayslipPeriodNoise(793.97, 'תוספת הסכם 2009 793.97')).toBe(false);
  });

  it('rejects calendar years as net_payable / gross_total', () => {
    expect(isImplausibleSalaryAmount('net_payable', 2009, 'תוספת הסכם 2009')).toBe(true);
    expect(isImplausibleSalaryAmount('gross_total', 2026, '')).toBe(true);
    expect(isImplausibleSalaryAmount('net_payable', 16454.93, 'שכר חודשי נטו 16454.930')).toBe(
      false,
    );
  });

  it('does not pick year 2009 over a real net when pairing with gross', () => {
    const warnings = [];
    const resolution = resolveGrossAndNetCandidates(
      [{ value: 24963.93, score: 0.95, source: 'gross_label' }],
      [
        { value: 2009, score: 0.92, source: 'agreement_year_collision' },
        { value: 16454.93, score: 0.88, source: 'net_label' },
      ],
      warnings,
    );

    expect(resolution.netCandidate?.value).toBe(16454.93);
    expect(resolution.grossCandidate?.value).toBe(24963.93);
  });

  it('penalises calendar-year net candidates in reconciler', () => {
    const candidates = [
      { value: 2009, score: 0.95, source: 'noise' },
      { value: 16454.93, score: 0.8, source: 'net_label' },
    ];
    const violations = [];
    applyNetArithmetic(candidates, 24963.93, 8509, violations);

    expect(candidates.find(c => c.value === 2009).score).toBeLessThan(0.2);
    expect(violations.some(v => v.rule === 'calendar_year_token')).toBe(true);
  });

  it('fails sanity checks when net is a calendar year or tiny vs gross', () => {
    const yearNet = runPayslipSanityChecks({
      salary: { gross_total: 24963.93, net_payable: 2009 },
    });
    expect(yearNet.passed).toBe(false);
    expect(yearNet.flaggedInconsistencies.join(' ')).toMatch(/calendar year|implausibly low/i);

    const ok = runPayslipSanityChecks({
      salary: { gross_total: 24963.93, net_payable: 16454.93 },
    });
    expect(ok.passed).toBe(true);
  });
});

describe('payslipSalaryBaseline', () => {
  it('computes median and boosts in-band net candidates', () => {
    expect(median([10000, 12000, 14000])).toBe(12000);
    expect(looksLikeCalendarYear(2009)).toBe(true);
    expect(looksLikeCalendarYear(16454.93)).toBe(false);

    const store = {
      net_payable: [
        { value: 2009, score: 0.9, reason: 'noise' },
        { value: 16454.93, score: 0.7, reason: 'real' },
      ],
      gross_total: [{ value: 24963.93, score: 0.9, reason: 'gross' }],
    };

    applySalaryBaselineToCandidates(store, {
      medianNet: 18000,
      medianGross: 26000,
      netMin: 18000 * 0.45,
      netMax: 18000 * 1.75,
      grossMin: 26000 * 0.4,
      grossMax: 26000 * 2.25,
      sampleCount: 3,
    });

    expect(store.net_payable.find(c => c.value === 2009).score).toBe(0);
    expect(store.net_payable.find(c => c.value === 16454.93).score).toBeGreaterThan(0.7);
  });

  it('clears resolved net that is a calendar year or absurd ratio', () => {
    const cleared = sanitizeResolvedSalaryAgainstBaseline(24963.93, 2009, {
      medianNet: 16000,
      netMin: 7200,
      netMax: 28000,
    });
    expect(cleared.net).toBeUndefined();
    expect(cleared.warnings.length).toBeGreaterThan(0);

    const ok = sanitizeResolvedSalaryAgainstBaseline(24963.93, 16454.93, {
      medianNet: 16000,
      netMin: 7200,
      netMax: 28000,
    });
    expect(ok.net).toBe(16454.93);
  });
});
