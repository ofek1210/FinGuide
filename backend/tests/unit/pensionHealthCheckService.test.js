

const { runPensionHealthCheck } = require('../../services/pensionHealthCheckService');

describe('pensionHealthCheckService', () => {
  const summary = {
    hasData: true,
    grossSalary: 18000,
    totalMonthlyContribution: 3600,
    currentAge: 35,
    retirementAge: 67,
    currentAccumulation: 185000,
    fundCount: 3,
    hasStudyFund: false,
  };

  const benchmark = {
    summary: {
      fundsAboveMarketFee: 1,
      riskMismatchCount: 0,
      recommendedRiskLevel: 'high',
    },
  };

  it('returns score 0-100 with four categories', () => {
    const result = runPensionHealthCheck(summary, benchmark);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.categories).toHaveLength(4);
    expect(result.level.label).toBeTruthy();
  });

  it('penalizes multiple funds and missing study fund', () => {
    const result = runPensionHealthCheck(summary, benchmark);
    const structure = result.categories.find(c => c.id === 'structure');
    expect(structure.status).not.toBe('good');
  });
});
