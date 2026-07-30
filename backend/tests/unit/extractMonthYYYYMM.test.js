const {
  extractMonthYYYYMM,
  extractMonthFromFilename,
} = require('../../services/payslipOcrShared');

describe('extractMonthYYYYMM', () => {
  it('reads titled לחודש MM/YYYY', () => {
    expect(extractMonthYYYYMM('תלוש שכר לחודש 06/2026')).toBe('2026-06');
    expect(extractMonthYYYYMM('לחודש 4/2026')).toBe('2026-04');
    expect(extractMonthYYYYMM('תלוש משכורת למשרתי קבע לחודש 05 / 2025')).toBe('2025-05');
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

  it('prefers MM-YYYY over trailing download copy suffix', () => {
    expect(extractMonthFromFilename('paycheck-05-2025-2.pdf')).toBe('2025-05');
    expect(extractMonthFromFilename('Paycheck May 2026.pdf')).toBeUndefined();
  });
});
