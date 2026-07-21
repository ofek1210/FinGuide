

const {
  aggregatePoliciesByPolicyNumber,
  analyzeAggregatedInsurance,
} = require('../../services/insurancePolicyAggregationService');

describe('insurancePolicyAggregationService', () => {
  it('aggregates 4 Har HaBituach rows with same policy number into 1 policy', () => {
    const rows = [
      { provider: 'הראל', policyNumber: '513826409', type: 'health', monthlyPremium: 120,
        rawData: { subBranch: 'תרופות מחוץ לסל' }, status: 'active' },
      { provider: 'הראל', policyNumber: '513826409', type: 'health', monthlyPremium: 80,
        rawData: { subBranch: 'השתלות' }, status: 'active' },
      { provider: 'הראל', policyNumber: '513826409', type: 'health', monthlyPremium: 95,
        rawData: { subBranch: 'ניתוחים בחו"ל' }, status: 'active' },
      { provider: 'הראל', policyNumber: '513826409', type: 'health', monthlyPremium: 55,
        rawData: { subBranch: 'מחלות קשות' }, status: 'active' },
    ];

    const aggregated = aggregatePoliciesByPolicyNumber(rows);
    expect(aggregated).toHaveLength(1);
    expect(aggregated[0].riderCount).toBe(4);
    expect(aggregated[0].monthlyPremium).toBe(350);
    expect(aggregated[0].hasCatastrophicRiders).toBe(true);

    const result = analyzeAggregatedInsurance(rows);
    expect(result.duplicateCount).toBe(0);
    expect(result.totalMonthlyWaste).toBe(0);
  });

  it('does not compute waste for cross-company catastrophic overlap', () => {
    const policies = [
      { provider: 'הראל', policyNumber: 'A1', type: 'health', monthlyPremium: 150,
        rawData: { subBranch: 'תרופות מחוץ לסל' }, status: 'active' },
      { provider: 'כלל', policyNumber: 'B2', type: 'health', monthlyPremium: 130,
        rawData: { subBranch: 'תרופות מחוץ לסל' }, status: 'active' },
    ];

    const result = analyzeAggregatedInsurance(policies);
    expect(result.totalMonthlyWaste).toBe(0);
    result.duplicates.forEach(d => {
      expect(d.estimatedMonthlyWaste).toBeNull();
      expect(d.recommendCancellation).toBe(false);
    });
  });

  it('reports optimized status when riders share one policy number', () => {
    const policies = [
      { provider: 'הראל', policyNumber: '513826409', type: 'health', monthlyPremium: 100,
        rawData: { subBranch: 'תרופות מחוץ לסל' }, status: 'active' },
      { provider: 'הראל', policyNumber: '513826409', type: 'health', monthlyPremium: 90,
        rawData: { subBranch: 'השתלות' }, status: 'active' },
    ];

    const result = analyzeAggregatedInsurance(policies);
    expect(result.aggregationSummary.totalPolicies).toBe(1);
    expect(result.aggregationSummary.redundantDuplications).toBe(0);
    expect(result.aggregationSummary.status).toBe('optimized');
  });
});
