'use strict';

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
  it('scores lower when duplicates exist', () => {
    const profileDTO = { policies: [{ type: 'life' }, { type: 'life' }] };
    const analysis = {
      duplicateCount: 1,
      totalMonthlyWaste: 300,
      missingCoverage: ['disability'],
      savings: { annualSavings: 3600 },
    };
    const health = runInsuranceHealthCheck(profileDTO, analysis);
    expect(health.score).toBeLessThan(70);
    expect(health.categories.length).toBe(4);
  });
});
