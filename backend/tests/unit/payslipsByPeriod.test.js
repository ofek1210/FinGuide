'use strict';

const { buildPayslipsByPeriod } = require('../../utils/payslipsByPeriod');

describe('buildPayslipsByPeriod', () => {
  it('resolves period from metadata and reads salary.* via enrichSummary', () => {
    const byPeriod = buildPayslipsByPeriod([
      {
        uploadedAt: '2026-06-01T00:00:00Z',
        metadata: { category: 'payslip', periodYear: 2026, periodMonth: 5 },
        analysisData: {
          salary: { gross_total: 24963.93, net_payable: 16454.93 },
          deductions: { mandatory: { income_tax: 3550.71 } },
        },
      },
    ]);

    expect(byPeriod['2026-05']).toEqual({
      netSalary: 16454.93,
      grossSalary: 24963.93,
      tax: 3550.71,
    });
  });

  it('falls back to analysis.period.month when metadata is missing', () => {
    const byPeriod = buildPayslipsByPeriod([
      {
        uploadedAt: '2026-07-01T00:00:00Z',
        metadata: { category: 'other' },
        analysisData: {
          period: { month: '2026-06' },
          summary: { grossSalary: 20000, netSalary: 15000 },
        },
      },
    ]);

    expect(byPeriod['2026-06'].netSalary).toBe(15000);
    expect(byPeriod['2026-06'].grossSalary).toBe(20000);
  });

  it('skips documents without a resolvable period', () => {
    const byPeriod = buildPayslipsByPeriod([
      {
        metadata: { category: 'payslip' },
        analysisData: { salary: { gross_total: 10000, net_payable: 8000 } },
      },
    ]);
    expect(byPeriod).toEqual({});
  });

  it('keeps the latest upload when two docs share a month', () => {
    const byPeriod = buildPayslipsByPeriod([
      {
        uploadedAt: '2026-05-01T00:00:00Z',
        metadata: { periodYear: 2026, periodMonth: 4 },
        analysisData: { salary: { gross_total: 10000, net_payable: 7000 } },
      },
      {
        uploadedAt: '2026-05-10T00:00:00Z',
        metadata: { periodYear: 2026, periodMonth: 4 },
        analysisData: { salary: { gross_total: 11000, net_payable: 8000 } },
      },
    ]);

    expect(byPeriod['2026-04'].netSalary).toBe(8000);
    expect(byPeriod['2026-04'].grossSalary).toBe(11000);
  });
});
