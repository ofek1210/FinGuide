'use strict';

const {
  toPensionSummary,
  toInsuranceSummary,
  toPayslipSummary,
  buildNarrativeHints,
  buildUnifiedSummaryFromInsights,
} = require('../../utils/domainSummaryMapper');

describe('domainSummaryMapper', () => {
  it('toPensionSummary maps analysis fields', () => {
    const summary = toPensionSummary({
      summary: { hasData: true, fundCount: 3 },
      healthCheck: { score: 80 },
      benchmark: { summary: { totalPotentialSavings: 120000, recommendedRiskLevel: 'moderate' } },
      recommendations: [{ title: 'דמי ניהול גבוהים' }, { title: 'מסלול סיכון' }],
    });
    expect(summary.hasData).toBe(true);
    expect(summary.healthScore).toBe(80);
    expect(summary.totalPotentialSavings).toBe(120000);
    expect(summary.topRecs).toEqual(['דמי ניהול גבוהים', 'מסלול סיכון']);
  });

  it('toInsuranceSummary maps imported policy analysis', () => {
    const summary = toInsuranceSummary({
      hasImportedPolicies: true,
      healthCheck: { score: 65 },
      analysis: { duplicateCount: 2, totalMonthlyWaste: 300 },
      recommendations: [{ title: 'כפילות ביטוח' }],
    });
    expect(summary.hasData).toBe(true);
    expect(summary.healthScore).toBe(65);
    expect(summary.duplicateCount).toBe(2);
    expect(summary.totalMonthlyWaste).toBe(300);
  });

  it('toPayslipSummary handles empty payslip', () => {
    expect(toPayslipSummary(null)).toEqual({
      latestGross: null,
      insightCount: 0,
      topInsights: [],
      hasData: false,
    });
  });

  it('buildNarrativeHints combines domain signals', () => {
    const hints = buildNarrativeHints(
      { healthScore: 40, totalPotentialSavings: 50000 },
      { healthScore: 55, duplicateCount: 1 },
      { latestGross: 18000 },
    );
    expect(hints.some(h => h.includes('פנסיונית'))).toBe(true);
    expect(hints.some(h => h.includes('כפילויות'))).toBe(true);
    expect(hints.some(h => h.includes('ברוטו'))).toBe(true);
  });

  it('buildUnifiedSummaryFromInsights maps insight payloads', () => {
    const unified = buildUnifiedSummaryFromInsights({
      pension: {
        meta: { healthScore: 70, totalPotentialSavings: 40000, fundCount: 2 },
        insights: [{ title: 'דמי ניהול' }],
      },
      insurance: {
        meta: { healthScore: 60, duplicateCount: 1, totalMonthlyWaste: 100, policyCount: 3 },
        insights: [{ title: 'כפילות' }],
      },
      payslip: {
        insights: [{ title: 'מס גבוה' }],
        meta: { avgGross: 15000 },
      },
    });
    expect(unified.pension.healthScore).toBe(70);
    expect(unified.insurance.duplicateCount).toBe(1);
    expect(unified.payslip.latestGross).toBe(15000);
    expect(unified.narrativeHints.length).toBeGreaterThan(0);
  });
});
