

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
  it('returns decision-backed numeric score', () => {
    const profileDTO = {
      policies: [{ id: '1', type: 'life', provider: 'הראל', policyNumber: '1', coverageAmount: 100, status: 'active', startDate: '2024-01-01' }],
    };
    const analysis = {
      duplicateCount: 0,
      duplicates: [],
      duplicateFindings: [],
      gapFindings: [],
      needAssessments: [],
      premiumUnderReviewMonthly: null,
      policies: profileDTO.policies,
    };
    const health = runInsuranceHealthCheck(profileDTO, analysis, {
      comparisonMatrix: [{ policyId: '1', type: 'life', provider: 'הראל', serviceScore: 85, serviceTier: 'excellent' }],
      companyQuality: { averageServiceIndex: 85, averageServiceTier: 'excellent' },
    });
    expect(health.score).not.toBeNull();
    expect(health.scoreDisabled).toBe(false);
    expect(health.categories.length).toBeGreaterThan(0);
  });
});
