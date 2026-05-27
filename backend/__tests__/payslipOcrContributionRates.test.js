const { parseTableContributionRates } = require('../services/payslipOcrContributions');

describe('parseTableContributionRates', () => {
  test('parses study fund table line rates by amount order', () => {
    const raw = 'קרן השתלמות 20,800 2.50 520 7.50 1,560';
    const parsed = parseTableContributionRates(raw, {
      base: 20800,
      employee: 520,
      employer: 1560,
    });

    expect(parsed.employeeRate).toBe(2.5);
    expect(parsed.employerRate).toBe(7.5);
  });

  test('parses pension table line rates by amount order', () => {
    const raw = 'פנסיה 26,000 6.00 1,560 6.50 1,690';
    const parsed = parseTableContributionRates(raw, {
      base: 26000,
      employee: 1560,
      employer: 1690,
    });

    expect(parsed.employeeRate).toBe(6);
    expect(parsed.employerRate).toBe(6.5);
  });
});
