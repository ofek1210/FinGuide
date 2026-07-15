const { mergePageResults } = require('../../services/payslipVisionPipeline');

describe('payslipVisionPipeline', () => {
  it('mergePageResults picks page with gross salary', () => {
    const pages = [
      { normalized: { salary: {} }, raw: { confidence: { salary: 0.9 } } },
      { normalized: { salary: { gross_total: 25000 } }, raw: { confidence: { salary: 0.8 } } },
    ];
    expect(mergePageResults(pages).normalized.salary.gross_total).toBe(25000);
  });

  it('mergePageResults returns single page as-is', () => {
    const single = [{ normalized: { salary: { gross_total: 1000 } }, raw: {} }];
    expect(mergePageResults(single)).toBe(single[0]);
  });
});
