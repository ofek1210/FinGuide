const fs = require('fs');
const path = require('path');

const { extractPayslipFinancialEN } = require('../../services/payslipOcr');

const readFixture = name =>
  fs.readFileSync(path.join(__dirname, '..', 'fixtures', name), 'utf8');

describe('extractPayslipFinancialEN - Hebrew payslip', () => {
  it('should parse basic gross/net and parties from hebrew OCR text', () => {
    const text = readFixture('payslip-he-1.txt');

    const result = extractPayslipFinancialEN(text, {
      sourcePath: 'PaySlip2024-02.pdf',
    });

    expect(result.period.month).toBe('2024-02');
    expect(result.salary.gross_total).toBe(20000);
    expect(result.salary.net_payable).toBe(14500);

    expect(result.deductions.mandatory.income_tax).toBe(3000);

    expect(result.parties.employee_name).toBe('עדי כהן');
    expect(result.parties.employee_id).toBe('123456789');
    expect(result.parties.employer_name).toBe('חברת דוגמה בע״מ');
  });
});

describe('extractPayslipFinancialEN - English payslip', () => {
  it('should parse basic fields from english OCR text', () => {
    const text = readFixture('payslip-en-1.txt');

    const result = extractPayslipFinancialEN(text, {
      sourcePath: 'PaySlip2024-03.pdf',
    });

    expect(result.period.month).toBe('2024-03');
    expect(result.salary.gross_total).toBe(18000);
    expect(result.salary.net_payable).toBe(13000);

    expect(result.deductions.mandatory.income_tax).toBe(2500);

    expect(result.parties.employee_name).toBe('Dana Levi');
    expect(result.parties.employer_name).toBe('Example Tech Ltd');
  });
});

describe('extractPayslipFinancialEN - partial data', () => {
  it('should handle missing fields gracefully and keep raw text', () => {
    const text = readFixture('payslip-partial-1.txt');

    const result = extractPayslipFinancialEN(text, {
      sourcePath: 'SomePaySlip-2024-04.pdf',
    });

    // No explicit period in text, but sourcePath has year-month
    expect(result.period.month).toBe('2024-04');

    // Some salaries are missing, should stay undefined
    expect(result.salary.gross_total).toBeUndefined();
    expect(result.salary.net_payable).toBeUndefined();

    // Raw text should be present for debugging
    expect(typeof result.raw.rawText).toBe('string');
    expect(result.raw.rawText.length).toBeGreaterThan(0);
  });
});

