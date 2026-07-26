'use strict';

const { buildFinancialInsight } = require('../../utils/financialInsightBuilder');
const { prioritizeFinancialInsights } = require('../../utils/financialInsightPrioritizer');

function insight(overrides) {
  return buildFinancialInsight({
    id: overrides.id || 'x',
    code: overrides.code || 'test',
    productType: 'PENSION',
    category: overrides.category || 'fees',
    severity: overrides.severity || 'medium',
    title: overrides.title || 't',
    reason: overrides.reason || 'r',
    suggestedAction: overrides.suggestedAction || 'a',
    confidence: 0.8,
    sources: [],
    productId: overrides.productId ?? 'fund-1',
    evidence: overrides.evidence || {},
    financialImpact: overrides.financialImpact,
    ...overrides,
  });
}

describe('financialInsightPrioritizer', () => {
  it('merges fee-related insights into one MANAGEMENT_FEES_REVIEW', () => {
    const fees = [
      insight({ id: 'f1', code: 'fee_cost_projection', severity: 'medium', financialImpact: { amount: 229, period: 'annual', currency: 'ILS' } }),
      insight({ id: 'f2', code: 'net_return_estimate', severity: 'info' }),
      insight({ id: 'f3', code: 'fee_cost_until_retirement', severity: 'medium', financialImpact: { amount: 4861, period: 'retirement', currency: 'ILS' } }),
    ];

    const result = prioritizeFinancialInsights(fees, { productType: 'PENSION' });
    expect(result.centralRecommendations).toHaveLength(1);
    expect(result.centralRecommendations[0].code).toBe('MANAGEMENT_FEES_REVIEW');
    expect(result.centralRecommendations[0].evidence.mergedFrom.length).toBeGreaterThan(1);
  });

  it('moves positive performance consistency to positiveFindings', () => {
    const positive = insight({
      id: 'p1',
      code: 'performance_consistency',
      category: 'performance',
      severity: 'info',
      reason: 'עקביות ביצועים טובה יחסית לקבוצה',
      evidence: { benchmark: { aboveMedianRate: 75 } },
    });

    const result = prioritizeFinancialInsights([positive], { productType: 'PENSION' });
    expect(result.centralRecommendations).toHaveLength(0);
    expect(result.positiveFindings).toHaveLength(1);
  });

  it('moves fund_size to hiddenTechnicalInsights', () => {
    const size = insight({ id: 's1', code: 'fund_size', category: 'fund_size', severity: 'info' });
    const result = prioritizeFinancialInsights([size], { productType: 'PENSION' });
    expect(result.centralRecommendations).toHaveLength(0);
    expect(result.hiddenTechnicalInsights.some(i => i.code === 'fund_size')).toBe(true);
  });

  it('does not centralize asset_allocation without profile conflict', () => {
    const alloc = insight({
      id: 'a1',
      code: 'asset_allocation',
      category: 'asset_allocation',
      severity: 'info',
    });
    const result = prioritizeFinancialInsights([alloc], { productType: 'PENSION' });
    expect(result.centralRecommendations).toHaveLength(0);
    expect(result.additionalInsights.some(i => i.code === 'asset_allocation')).toBe(true);
  });

  it('centralizes asset_allocation when severity indicates profile conflict', () => {
    const alloc = insight({
      id: 'a2',
      code: 'asset_allocation',
      category: 'asset_allocation',
      severity: 'medium',
    });
    const result = prioritizeFinancialInsights([alloc], { productType: 'PENSION' });
    expect(result.centralRecommendations).toHaveLength(1);
  });

  it('filters no_study_fund on pension-only analysis', () => {
    const study = insight({ id: 'h1', code: 'no_study_fund', category: 'study_fund', severity: 'medium' });
    const result = prioritizeFinancialInsights([study], { productType: 'PENSION' });
    expect(result.centralRecommendations).toHaveLength(0);
    expect(result.positiveFindings).toHaveLength(0);
    expect(result.additionalInsights).toHaveLength(0);
  });
});
