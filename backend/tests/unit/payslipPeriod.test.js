const {
  parsePeriodMonth,
  canonicalPeriodMonth,
  syncPayslipPeriodMetadata,
} = require('../../utils/payslipPeriod');

describe('payslipPeriod', () => {
  it('parses YYYY-MM', () => {
    expect(parsePeriodMonth('2026-07')).toEqual({ year: 2026, month: 7 });
  });

  it('parses MM/YYYY', () => {
    expect(parsePeriodMonth('07/2026')).toEqual({ year: 2026, month: 7 });
    expect(parsePeriodMonth('7/2026')).toEqual({ year: 2026, month: 7 });
  });

  it('canonicalizes to YYYY-MM', () => {
    expect(canonicalPeriodMonth('06/2026')).toBe('2026-06');
    expect(canonicalPeriodMonth('2026-06')).toBe('2026-06');
  });

  it('syncPayslipPeriodMetadata overwrites filename metadata from analysis', () => {
    const doc = {
      metadata: { periodYear: 2026, periodMonth: 5, category: 'payslip' },
      analysisData: { period: { month: '07/2026' } },
    };
    const changed = syncPayslipPeriodMetadata(doc, doc.analysisData);
    expect(changed).toBe(true);
    expect(doc.metadata.periodYear).toBe(2026);
    expect(doc.metadata.periodMonth).toBe(7);
  });
});
