const {
  buildPayslipHistoryIntelligence,
  resolvePayslipPeriod,
} = require('../../services/payslipHistoryAggregationService');
const { calculateAnnualTaxAdjustment } = require('../../services/taxAdjustmentRulesService');

describe('payslip history aggregation service', () => {
  it('resolves period from metadata before OCR fields', () => {
    const period = resolvePayslipPeriod({
      metadata: { periodYear: 2026, periodMonth: 3 },
      analysisData: { period: { month: '2025-12' } },
    });

    expect(period).toEqual(
      expect.objectContaining({
        year: 2026,
        month: 3,
        source: 'metadata',
        incompletePeriod: false,
      }),
    );
  });

  it('builds yearly stats and detects missing months', () => {
    const docs = [
      {
        _id: 'jan',
        status: 'completed',
        uploadedAt: '2026-01-25T10:00:00.000Z',
        metadata: { periodYear: 2026, periodMonth: 1 },
        analysisData: { summary: { grossSalary: 20000, netSalary: 14000, tax: 2500 } },
      },
      {
        _id: 'mar',
        status: 'completed',
        uploadedAt: '2026-03-25T10:00:00.000Z',
        metadata: { periodYear: 2026, periodMonth: 3 },
        analysisData: { summary: { grossSalary: 22000, netSalary: 15500, tax: 2900 } },
      },
    ];

    const result = buildPayslipHistoryIntelligence(docs, { year: 2026 });

    expect(result.selectedYear).toBe(2026);
    expect(result.selectedYearStats.monthsPresent).toEqual([1, 3]);
    expect(result.selectedYearStats.missingMonths).toContain(2);
    expect(result.selectedYearStats.grossAverage).toBe(21000);
    expect(result.selectedYearStats.netAverage).toBe(14750);
    expect(result.items).toHaveLength(2);
  });
});

describe('tax adjustment rules service', () => {
  it('returns partial status and expected refund/due estimate', () => {
    const tax = calculateAnnualTaxAdjustment({
      year: 2026,
      grossTotal: 240000,
      taxPaidTotal: 38000,
      monthsPresent: [1, 2, 3, 4, 5, 6, 7, 8],
      missingMonths: [9, 10, 11, 12],
      taxCreditPointsAverage: 2.25,
    });

    expect(tax.status).toBe('partial');
    expect(tax.expectedAnnualTax).toBeGreaterThan(0);
    expect(Number.isFinite(tax.estimatedRefundOrDue)).toBe(true);
    expect(tax.assumptions.length).toBeGreaterThan(0);
  });
});
