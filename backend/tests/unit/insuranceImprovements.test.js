

const { policyMergeKey, mergePolicyRecord } = require('../../services/insurancePolicyMergeService');
const { runInsuranceHealthCheck } = require('../../services/insuranceHealthCheckService');

describe('insurancePolicyMergeService', () => {
  it('policyMergeKey prefers policy number', () => {
    const key = policyMergeKey({ provider: 'הפניקס', policyNumber: 'P-001', type: 'life' });
    expect(key).toContain('num');
  });

  it('mergePolicyRecord keeps incoming premium when set', () => {
    const merged = mergePolicyRecord(
      { type: 'life', monthlyPremium: 100, provider: 'הפניקס' },
      { monthlyPremium: 120, type: 'life' },
    );
    expect(merged.monthlyPremium).toBe(120);
  });
});

describe('insuranceHealthCheckService', () => {
  it('disables numerical score until evidence-backed dimensions exist', () => {
    const profileDTO = { policies: [{ type: 'life' }, { type: 'life' }] };
    const analysis = {
      duplicateCount: 1,
      totalMonthlyWaste: 300,
      premiumUnderReviewMonthly: 300,
      missingCoverage: ['disability'],
      savings: { annualSavings: 0 },
    };
    const health = runInsuranceHealthCheck(profileDTO, analysis);
    expect(health.score).toBeNull();
    expect(health.scoreDisabled).toBe(true);
    expect(health.messageHe).toMatch(/השלמת מידע/);
    expect(health.categories).toHaveLength(0);
  });
});
