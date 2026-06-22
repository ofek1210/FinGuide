'use strict';

jest.mock('../../services/pensionAnalysisService', () => ({
  buildPensionAnalysis: jest.fn().mockResolvedValue({
    summary: { hasData: true },
    healthCheck: { score: 72 },
    benchmark: { summary: { totalPotentialSavings: 50000 } },
    recommendations: [{ title: 'דמי ניהול גבוהים' }],
  }),
}));

jest.mock('../../services/insuranceAnalysisService', () => ({
  buildInsuranceAnalysis: jest.fn().mockResolvedValue({
    hasImportedPolicies: true,
    summary: { hasData: true },
    healthCheck: { score: 65 },
    analysis: { duplicateCount: 1, totalMonthlyWaste: 200, savings: { annualSavings: 2400 } },
    recommendations: [{ title: 'כפילות ביטוח' }],
  }),
}));

jest.mock('../../services/payslipInsightsService', () => ({
  getPayslipInsights: jest.fn().mockResolvedValue({
    insights: [{ title: 'מס גבוה', financialImpact: 1000 }],
    meta: { avgGross: 15000 },
  }),
}));

const { buildUnifiedSummary } = require('../../services/unifiedSummaryService');

describe('unifiedSummaryService', () => {
  it('buildUnifiedSummary returns structured sections', async () => {
    const summary = await buildUnifiedSummary('user-1');
    expect(summary.pension.healthScore).toBe(72);
    expect(summary.insurance.healthScore).toBe(65);
    expect(summary.payslip.latestGross).toBe(15000);
    expect(summary.narrativeHints.length).toBeGreaterThan(0);
  });
});
