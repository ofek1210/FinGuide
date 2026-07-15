const { runPayslipSanityChecks, approxEqual } = require('../../services/payslipSanityChecks');

function basePayload(overrides = {}) {
  return {
    schema_version: '1.9',
    salary: { gross_total: 30000, net_payable: 20000 },
    deductions: { mandatory: { total: 5000 }, voluntary_total: 0 },
    contributions: {
      pension: { employee: 1000, employer: 1500, participation_total: 2500 },
      study_fund: { employee: 300, employer: 700, participation_total: 1000 },
    },
    ...overrides,
  };
}

describe('payslipSanityChecks', () => {
  it('passes when pension employee + employer equals total', () => {
    const result = runPayslipSanityChecks(basePayload());
    expect(result.passed).toBe(true);
    expect(result.flaggedInconsistencies).toHaveLength(0);
  });

  it('flags when pension employee + employer does not match total', () => {
    const result = runPayslipSanityChecks(basePayload({
      contributions: {
        pension: { employee: 1000, employer: 1500, participation_total: 3000 },
        study_fund: { employee: 300, employer: 700, participation_total: 1000 },
      },
    }));
    expect(result.passed).toBe(false);
    expect(result.flaggedInconsistencies.some(i => i.includes('pension'))).toBe(true);
  });

  it('flags when net exceeds gross', () => {
    const result = runPayslipSanityChecks(basePayload({
      salary: { gross_total: 10000, net_payable: 12000 },
    }));
    expect(result.passed).toBe(false);
    expect(result.flaggedInconsistencies[0]).toMatch(/net_payable/);
  });

  it('approxEqual respects relative tolerance', () => {
    expect(approxEqual(1000, 1005, 2)).toBe(true);
    expect(approxEqual(1000, 1100, 2)).toBe(false);
  });
});
