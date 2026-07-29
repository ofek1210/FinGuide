const {
  extractMonthYYYYMM,
  extractMonthFromFilename,
} = require('../../services/payslipOcrShared');

describe('extractMonthYYYYMM', () => {
  it('reads titled לחודש MM/YYYY', () => {
    expect(extractMonthYYYYMM('תלוש שכר לחודש 06/2026')).toBe('2026-06');
    expect(extractMonthYYYYMM('לחודש 4/2026')).toBe('2026-04');
  });

  it('reads Hebrew month + year', () => {
    expect(extractMonthYYYYMM('יוני 2026')).toBe('2026-06');
    expect(extractMonthYYYYMM('אפריל 2026')).toBe('2026-04');
  });

  it('reads YYYY-MM and MM.YYYY', () => {
    expect(extractMonthYYYYMM('תקופה: 2026-06')).toBe('2026-06');
    expect(extractMonthYYYYMM('חודש 06.2026')).toBe('2026-06');
  });
});

describe('extractMonthFromFilename', () => {
  it('parses common filename patterns', () => {
    expect(extractMonthFromFilename('/tmp/2026-06-payslip.pdf')).toBe('2026-06');
    expect(extractMonthFromFilename('payslip_06-2026.pdf')).toBe('2026-06');
    expect(extractMonthFromFilename('יוני_2026.pdf')).toBe('2026-06');
  });
});
