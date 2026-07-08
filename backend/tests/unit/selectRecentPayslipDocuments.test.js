

const { selectRecentPayslipDocuments, isAnalyzablePayslip } = require('../../utils/selectRecentPayslipDocuments');

function makeDoc(id, periodMonth, uploadedAt, overrides = {}) {
  return {
    _id: id,
    originalName: `${periodMonth}.pdf`,
    status: 'completed',
    uploadedAt,
    metadata: { category: 'payslip' },
    analysisData: {
      period: { month: periodMonth },
      salary: { gross_total: 10000, net_payable: 7000 },
      summary: { grossSalary: 10000, netSalary: 7000 },
    },
    ...overrides,
  };
}

describe('selectRecentPayslipDocuments', () => {
  it('selects by salary period descending, not upload date', () => {
    const docs = [
      makeDoc('m', '2025-03', '2025-04-01T10:00:00Z'),
      makeDoc('j', '2025-01', '2025-04-03T10:00:00Z'),
      makeDoc('f', '2025-02', '2025-04-02T10:00:00Z'),
      makeDoc('old', '2024-11', '2025-05-01T10:00:00Z'),
    ];

    const recent = selectRecentPayslipDocuments(docs, 3);
    expect(recent.map(d => d._id)).toEqual(['m', 'f', 'j']);
  });

  it('dedupes same month keeping latest upload', () => {
    const docs = [
      makeDoc('old-jan', '2025-01', '2025-02-01T10:00:00Z'),
      makeDoc('new-jan', '2025-01', '2025-03-01T10:00:00Z'),
      makeDoc('feb', '2025-02', '2025-03-02T10:00:00Z'),
    ];

    const recent = selectRecentPayslipDocuments(docs, 3);
    expect(recent.map(d => d._id)).toEqual(['feb', 'new-jan']);
  });

  it('excludes failed payslips', () => {
    const doc = makeDoc('bad', '2025-02', '2025-03-01T10:00:00Z', { status: 'failed' });
    expect(isAnalyzablePayslip(doc)).toBe(false);
    expect(selectRecentPayslipDocuments([doc], 3)).toEqual([]);
  });
});
