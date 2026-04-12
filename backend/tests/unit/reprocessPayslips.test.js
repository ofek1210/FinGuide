const {
  buildAggregateReport,
  buildReport,
} = require('../../scripts/reprocessPayslips');

describe('reprocessPayslips script helpers', () => {
  it('builds aggregate field coverage and warning deltas across reports', () => {
    const reportA = buildReport(
      {
        _id: 'doc-1',
        originalName: 'a.pdf',
        analysisData: {
          schema_version: '1.7',
          quality: { confidence: 0.6, resolution_score: 9, resolved_core_fields: 5, warnings: ['old warning'] },
          period: { month: '2025-01' },
          salary: { gross_total: 10000 },
          deductions: { mandatory: {} },
          parties: {},
        },
      },
      {
        schema_version: '1.8',
        quality: { confidence: 0.8, resolution_score: 11, resolved_core_fields: 7, warnings: ['new warning'] },
        period: { month: '2025-01' },
        salary: { gross_total: 10000, net_payable: 7200 },
        deductions: { mandatory: { income_tax: 1200 } },
        parties: { employee_name: 'Dana Levi' },
      },
    );

    const aggregate = buildAggregateReport([reportA]);

    expect(aggregate.documents).toBe(1);
    expect(aggregate.schema_version_changes['1.7->1.8']).toBe(1);
    expect(aggregate.field_coverage_delta.net_payable).toBe(1);
    expect(aggregate.warning_counts.added['new warning']).toBe(1);
    expect(aggregate.warning_counts.removed['old warning']).toBe(1);
  });
});
