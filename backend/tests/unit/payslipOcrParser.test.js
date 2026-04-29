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

describe('extractPayslipFinancialEN - regression coverage', () => {
  it('does not swap gross/net when explicit candidates conflict', () => {
    const text = readFixture('payslip-he-regression-no-swap.txt');

    const result = extractPayslipFinancialEN(text, {
      sourcePath: 'PaySlip2024-05.pdf',
    });

    expect(result.period.month).toBe('2024-05');
    expect(result.salary.gross_total).toBe(15000);
    expect(result.salary.net_payable).toBeUndefined();
    expect(result.summary.grossSalary).toBe(15000);
    expect(result.summary.netSalary).toBeNull();
    expect(result.quality.warnings).toContain(
      'Conflicting gross/net candidates detected; kept only the stronger validated salary field.'
    );
  });

  it('omits pension and study-fund employee/employer amounts when roles are ambiguous', () => {
    const text = readFixture('payslip-he-regression-ambiguous-pension.txt');

    const result = extractPayslipFinancialEN(text, {
      sourcePath: 'PaySlip2024-06.pdf',
    });

    expect(result.period.month).toBe('2024-06');
    expect(result.contributions.pension.employee).toBeUndefined();
    expect(result.contributions.pension.employer).toBeUndefined();
    expect(result.contributions.study_fund.employee).toBeUndefined();
    expect(result.contributions.study_fund.employer).toBeUndefined();
    expect(result.quality.warnings).toEqual(
      expect.arrayContaining([
        'Pension contribution lines found but employee/employer roles were ambiguous.',
        'Study fund amounts found but employee/employer roles were ambiguous.',
      ])
    );
  });

  it('prefers labeled employee identity over heuristic name-id matches', () => {
    const text = readFixture('payslip-he-regression-party-priority.txt');

    const result = extractPayslipFinancialEN(text, {
      sourcePath: 'PaySlip2024-07.pdf',
    });

    expect(result.period.month).toBe('2024-07');
    expect(result.parties.employee_name).toBe('דנה לוי');
    expect(result.parties.employee_id).toBe('123456789');
    expect(result.quality.fields.employee_id).toEqual(
      expect.objectContaining({
        source: 'employee_id_label',
      })
    );
  });

  it('prefers validated table-header totals over tax-base noise lines', () => {
    const text = readFixture('payslip-he-regression-table-header.txt');

    const result = extractPayslipFinancialEN(text, {
      sourcePath: 'PaySlip2024-08.pdf',
    });

    expect(result.period.month).toBe('2024-08');
    expect(result.salary.gross_total).toBe(4072.05);
    expect(result.salary.net_payable).toBe(3861);
    expect(result.deductions.mandatory.total).toBe(211.05);
    expect(result.tax.gross_for_income_tax).toBe(9000);
    expect(result.summary.grossSalary).toBe(4072.05);
    expect(result.summary.netSalary).toBe(3861);
  });

  it('parses merged numeric tokens without collapsing gross salary fields', () => {
    const text = readFixture('payslip-he-regression-merged-numbers.txt');

    const result = extractPayslipFinancialEN(text, {
      sourcePath: 'PaySlip2024-09.pdf',
    });

    expect(result.schema_version).toBe('1.9');
    expect(result.period.month).toBe('2024-09');
    expect(result.salary.gross_total).toBe(4072.05);
    expect(result.summary.grossSalary).toBe(4072.05);
  });

  it('ignores cumulative duplicate labels when resolving deduction amounts', () => {
    const text = readFixture('payslip-he-regression-duplicate-labels.txt');

    const result = extractPayslipFinancialEN(text, {
      sourcePath: 'PaySlip2024-10.pdf',
    });

    expect(result.period.month).toBe('2024-10');
    expect(result.deductions.mandatory.income_tax).toBe(1200);
    expect(result.deductions.mandatory.national_insurance).toBe(450);
    expect(result.deductions.mandatory.health_insurance).toBe(220);
  });

  it('keeps period.month authoritative when date text disagrees', () => {
    const text = readFixture('payslip-he-regression-month-date-disagreement.txt');

    const result = extractPayslipFinancialEN(text, {
      sourcePath: 'PaySlip2024-02.pdf',
    });

    expect(result.period.month).toBe('2024-02');
    expect(result.summary.date).toBe('2024-02');
  });

  it('does not assign pension amounts when the resolved pension base does not support the OCR amounts', () => {
    const text = readFixture('payslip-he-regression-pension-base-mismatch.txt');

    const result = extractPayslipFinancialEN(text, {
      sourcePath: 'PaySlip2024-11.pdf',
    });

    expect(result.period.month).toBe('2024-11');
    expect(result.contributions.pension.employee).toBeUndefined();
    expect(result.contributions.pension.employer).toBeUndefined();
    expect(result.quality.warnings).toContain(
      'Pension contribution lines found but employee/employer roles were ambiguous.',
    );
  });

  it('resolves wrapped deduction labels from adjacent lines without corrupting salary fields', () => {
    const text = readFixture('payslip-he-regression-wrapped-label.txt');

    const result = extractPayslipFinancialEN(text, {
      sourcePath: 'PaySlip2024-12.pdf',
    });

    expect(result.period.month).toBe('2024-12');
    expect(result.salary.gross_total).toBe(18000);
    expect(result.deductions.mandatory.total).toBe(4200);
    expect(result.deductions.mandatory.income_tax).toBe(2500);
  });

  it('handles mixed Hebrew and English labels in the same payslip', () => {
    const text = readFixture('payslip-he-regression-mixed-labels.txt');

    const result = extractPayslipFinancialEN(text, {
      sourcePath: 'PaySlip2025-01.pdf',
    });

    expect(result.period.month).toBe('2025-01');
    expect(result.salary.gross_total).toBe(13850);
    expect(result.salary.net_payable).toBe(11050);
    expect(result.salary.components).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'base_salary', amount: 12000 }),
        expect.objectContaining({ type: 'global_overtime', amount: 1500 }),
        expect.objectContaining({ type: 'travel_expenses', amount: 350 }),
      ]),
    );
  });

  it('parses broken European decimal separators consistently', () => {
    const text = readFixture('payslip-he-regression-broken-decimals.txt');

    const result = extractPayslipFinancialEN(text, {
      sourcePath: 'PaySlip2025-02.pdf',
    });

    expect(result.period.month).toBe('2025-02');
    expect(result.salary.gross_total).toBe(18500.75);
    expect(result.salary.net_payable).toBe(15170);
    expect(result.deductions.mandatory.total).toBe(3330.75);
  });

  it('keeps tax-base rows separate from earnings rows in row-shifted tables', () => {
    const text = readFixture('payslip-he-regression-row-shifted-table.txt');

    const result = extractPayslipFinancialEN(text, {
      sourcePath: 'PaySlip2025-03.pdf',
    });

    expect(result.period.month).toBe('2025-03');
    expect(result.salary.gross_total).toBe(8650);
    expect(result.salary.net_payable).toBe(6900);
    expect(result.tax.gross_for_income_tax).toBe(12000);
    expect(result.summary.tax).toBe(1100);
  });

  it('parses OCR JSON input through the same structured output contract', () => {
    const json = JSON.parse(readFixture('payslip-ocr-json-sample.json'));

    const result = extractPayslipFinancialEN(
      {
        ocrJson: json,
      },
      {
        sourcePath: 'PaySlip2025-04.pdf',
      },
    );

    expect(result.period.month).toBe('2025-04');
    expect(result.salary.gross_total).toBe(20000);
    expect(result.salary.net_payable).toBe(15500);
    expect(result.deductions.mandatory.total).toBe(4500);
    expect(result.summary.grossSalary).toBe(20000);
    expect(result.summary.netSalary).toBe(15500);
  });

  it('resolves wrapped pension contribution labels from adjacent amount lines', () => {
    const text = readFixture('payslip-he-regression-wrapped-contributions.txt');

    const result = extractPayslipFinancialEN(text, {
      sourcePath: 'PaySlip2025-05.pdf',
    });

    expect(result.period.month).toBe('2025-05');
    expect(result.contributions.pension.base_salary_for_pension).toBe(12000);
    expect(result.contributions.pension.employee).toBe(720);
    expect(result.contributions.pension.employer).toBe(780);
    expect(result.contributions.pension.severance).toBe(999.6);
  });

  it('ignores cumulative contribution sections when current-period lines are present', () => {
    const text = readFixture('payslip-he-regression-cumulative-contributions.txt');

    const result = extractPayslipFinancialEN(text, {
      sourcePath: 'PaySlip2025-06.pdf',
    });

    expect(result.period.month).toBe('2025-06');
    expect(result.contributions.pension.employee).toBe(600);
    expect(result.contributions.pension.employer).toBe(650);
    expect(result.contributions.pension.severance).toBe(833);
  });

  it('keeps employee identity authoritative when contribution blocks contain employer identifiers', () => {
    const text = readFixture('payslip-he-regression-contribution-id-collision.txt');

    const result = extractPayslipFinancialEN(text, {
      sourcePath: 'PaySlip2025-07.pdf',
    });

    expect(result.period.month).toBe('2025-07');
    expect(result.parties.employee_name).toBe('גיל כהן');
    expect(result.parties.employee_id).toBe('123456780');
    expect(result.quality.fields.employee_id).toEqual(
      expect.objectContaining({
        source: 'employee_id_label',
      }),
    );
  });

  it('keeps tax-base and net-pay rows separate when values overlap numerically', () => {
    const text = readFixture('payslip-he-regression-tax-net-overlap.txt');

    const result = extractPayslipFinancialEN(text, {
      sourcePath: 'PaySlip2025-08.pdf',
    });

    expect(result.period.month).toBe('2025-08');
    expect(result.salary.gross_total).toBe(11450);
    expect(result.salary.net_payable).toBe(11050);
    expect(result.tax.gross_for_income_tax).toBe(11200);
    expect(result.national_insurance.gross_for_national_insurance).toBe(11200);
  });

  it('attaches normalized warning categories to extraction quality', () => {
    const text = readFixture('payslip-he-regression-ambiguous-pension.txt');

    const result = extractPayslipFinancialEN(text, {
      sourcePath: 'PaySlip2024-06.pdf',
    });

    expect(result.quality.warning_categories).toEqual(
      expect.arrayContaining([
        'ambiguous.contributions.pension_roles',
        'ambiguous.contributions.study_roles',
      ]),
    );
  });
});
