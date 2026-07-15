const fs = require('fs');
const path = require('path');
const {
  IDF_CONTRIBUTION_COLUMNS,
  IDF_SALARY_COLUMNS,
  detectIdfPayslip,
  findIdfColumnForLine,
  lineMatchesIdfColumn,
} = require('../../services/idfPayslipProfile');
const {
  collectContributionCandidates,
  resolveContributionCandidates,
} = require('../../services/payslipOcrContributions');
const { extractPayslipFinancialEN } = require('../../services/payslipOcr');

const readFixture = name =>
  fs.readFileSync(path.join(__dirname, '..', 'fixtures', name), 'utf8');

describe('idfPayslipProfile', () => {
  it('defines the four canonical IDF contribution columns', () => {
    expect(IDF_CONTRIBUTION_COLUMNS.map(column => column.field)).toEqual([
      'pension_employee',
      'pension_participation_total',
      'study_employee',
      'study_participation_total',
    ]);
  });

  it('detects IDF payslips from employer header and contribution columns', () => {
    const lines = readFixture('payslip-he-regression-idf-june.txt').split('\n').filter(Boolean);
    expect(detectIdfPayslip(lines.map(raw => ({ raw })))).toBe(true);
  });

  it('detects IDF payslips from contribution columns alone', () => {
    const lines = [
      { raw: 'ניכוי_לקרן_הפנסיה 1000' },
      { raw: 'השתתפות_בקרן_הפנסיה 2000' },
    ];
    expect(detectIdfPayslip(lines)).toBe(true);
  });

  it('does not treat standard Michpal labels as IDF payslips', () => {
    const lines = [
      { raw: 'ניכוי לקרן פנסיה 1,080' },
      { raw: 'ניכוי לקרן השתלמות 360' },
      { raw: 'הפרשת מעסיק לקרן פנסיה 1,170' },
    ];
    expect(detectIdfPayslip(lines)).toBe(false);
  });

  it('maps each canonical column label to the correct field', () => {
    expect(findIdfColumnForLine('ניכוי_לקרן_הפנסיה 2112.62')?.field).toBe('pension_employee');
    expect(findIdfColumnForLine('השתתפות_בקרן_הפנסיה 3176.41')?.field).toBe(
      'pension_participation_total',
    );
    expect(findIdfColumnForLine('ניכוי_לקרן__השתלמות 743.61')?.field).toBe('study_employee');
    expect(findIdfColumnForLine('השתתפות_בקרן_ההשתלמו 1744.17')?.field).toBe(
      'study_participation_total',
    );
  });

  it('accepts OCR typo נכוי instead of ניכוי', () => {
    const studyColumn = IDF_CONTRIBUTION_COLUMNS.find(column => column.field === 'study_employee');
    expect(lineMatchesIdfColumn('נכוי_לקרן__השתלמות', studyColumn)).toBe(true);
  });

  it('extracts gross and net from IDF salary columns including split lines', () => {
    const store = {};
    const pushCandidate = (target, field, value, meta) => {
      target[field] = target[field] || [];
      target[field].push({ field, value, ...meta });
    };
    const entries = [
      { raw: 'צבא הגנה לישראל', index: 0 },
      { raw: 'סה_כ_תשלומים_שוטפים', index: 1 },
      { raw: '30391.26', index: 2 },
      { raw: 'שכר_חודשי_נטו 10020.00', index: 3 },
    ];

    const { extractIdfSalaryColumns } = require('../../services/idfPayslipProfile');
    const { resolveBestNumericCandidate } = require('../../services/payslipOcrResolver');

    extractIdfSalaryColumns(entries, store, pushCandidate);

    expect(resolveBestNumericCandidate('gross_total', store.gross_total)?.value).toBe(30391.26);
    expect(resolveBestNumericCandidate('net_payable', store.net_payable)?.value).toBe(10020);
  });

  it('extracts gross from pdftotext-style layout (spaces, amount before label)', () => {
    const layouts = [
      'צבא הגנה לישראל\nתלוש שכר לחודש 06/2026\n30391.26    סה"כ תשלומים שוטפים\nשכר חודשי נטו 10020.00',
      'צבא הגנה לישראל\nסה"כ תשלומים שוטפים          30391.26\nשכר חודשי נטו 10020.00',
      'צבא הגנה לישראל\nסה"כ תשלומים שוטפים\n30391.26\nשכר חודשי נטו 10020.00',
      'צבא הגנה לישראל\nסה כ תשלומים שוטפים 30391.26\nשכר חודשי נטו 10020.00',
      'צבא הגנה לישראל\nתלוש שכר לחודש 06/2026\n                    סה"כ תשלומים שוטפים              שכר חודשי נטו\n                    30391.26                           10020.00',
      'צבא הגנה לישראל\nסה"כ תשלו\nמים שוטפים\n30391.26\nשכר חודשי נטו 10020.00',
    ];

    return Promise.all(
      layouts.map(async text => {
        const result = await extractPayslipFinancialEN(text, { sourcePath: 'PaySlip2026-06.pdf' });
        expect(result.salary.gross_total).toBe(30391.26);
        expect(result.salary.net_payable).toBe(10020);
        expect(result.salary.gross_total).not.toBe(result.salary.net_payable);
      }),
    );
  });

  it('does not treat סך_כל_התשלומים as IDF gross (only שוטפים column)', () => {
    const grossColumn = IDF_SALARY_COLUMNS.find(column => column.field === 'gross_total');
    expect(lineMatchesIdfColumn('סך_כל_התשלומים 25000', grossColumn)).toBe(false);
    expect(lineMatchesIdfColumn('סה"כ תשלומים שוטפים 30391.26', grossColumn)).toBe(true);
    expect(lineMatchesIdfColumn('סה_כ_תשלומים_שוטפים 30391.26', grossColumn)).toBe(true);
  });
});

describe('IDF payslip contribution extraction across months', () => {
  const cases = [
    {
      name: 'May 2026',
      lines: [
        'ניכוי_לקרן_הפנסיה 2112.62',
        'השתתפות_בקרן_הפנסיה 3176.41',
        'ניכוי_לקרן__השתלמות 743.61',
        'השתתפות_בקרן_ההשתלמו 1744.17',
      ],
      pension: { employee: 2112.62, employer: 3176.41, participation_total: 5289.03 },
      study: { employee: 743.61, employer: 1744.17, participation_total: 2487.78 },
    },
    {
      name: 'June 2026',
      lines: [
        'ניכוי_לקרן_הפנסיה 2112.62',
        'השתתפות_בקרן_הפנסיה 3176.41',
        'ניכוי_לקרן__השתלמות 743.61',
        'השתתפות_בקרן_ההשתלמו 1744.17',
      ],
      pension: { employee: 2112.62, employer: 3176.41, participation_total: 5289.03 },
      study: { employee: 743.61, employer: 1744.17, participation_total: 2487.78 },
    },
    {
      name: 'March 2025',
      lines: [
        'ניכוי_לקרן_הפנסיה 1980.50',
        'השתתפות_בקרן_הפנסיה 2970.75',
        'ניכוי_לקרן__השתלמות 680.25',
        'השתתפות_בקרן_ההשתלמו 1594.50',
      ],
      pension: { employee: 1980.5, employer: 2970.75, participation_total: 4951.25 },
      study: { employee: 680.25, employer: 1594.5, participation_total: 2274.75 },
    },
  ];

  it('picks current-month pension employee when OCR merges prior month on same line', () => {
    const lines = [
      'צבא הגנה לישראל',
      '3637.60 ניכוי לקרן פנסיה 2112.621647.03',
      'השתתפות בקרן הפנסיה 3,176.41',
    ];
    const collected = collectContributionCandidates(lines);
    const resolved = resolveContributionCandidates(collected.store, collected.stats, []);

    expect(resolved.pension.employee).toBe(1647.03);
    expect(resolved.pension.employer).toBe(3176.41);
    expect(resolved.pension.participation_total).toBe(4823.44);
  });

  it('ignores glued pay-period suffix on IDF participation lines (01.06.26 → not employer=26)', () => {
    const lines = [
      'צבא הגנה לישראל',
      'ניכוי_לקרן_הפנסיה 1647.03',
      'השתתפות_בקרן_הפנסיה 3,176.4101.06.26',
      'ניכוי_לקרן__השתלמות 581.39',
      'השתתפות_בקרן_ההשתלמו 1,744.1701.06.26',
    ];
    const collected = collectContributionCandidates(lines);
    const resolved = resolveContributionCandidates(collected.store, collected.stats, []);

    expect(resolved.pension.employee).toBe(1647.03);
    expect(resolved.pension.employer).toBe(3176.41);
    expect(resolved.pension.participation_total).toBe(4823.44);
    expect(resolved.study.employee).toBe(581.39);
    expect(resolved.study.employer).toBe(1744.17);
    expect(resolved.study.participation_total).toBe(2325.56);
  });

  it.each(cases)('extracts employee vs participation for $name', ({ lines, pension, study }) => {
    const collected = collectContributionCandidates(lines);
    const resolved = resolveContributionCandidates(collected.store, collected.stats, []);

    expect(collected.stats.idfProfileDetected).toBe(true);
    expect(resolved.pension.employee).toBe(pension.employee);
    expect(resolved.pension.employer).toBe(pension.employer);
    expect(resolved.pension.participation_total).toBe(pension.participation_total);
    expect(resolved.study.employee).toBe(study.employee);
    expect(resolved.study.employer).toBe(study.employer);
    expect(resolved.study.participation_total).toBe(study.participation_total);
  });

  it.each([
    'payslip-he-regression-idf-may.txt',
    'payslip-he-regression-idf-june.txt',
    'payslip-he-regression-idf-march.txt',
  ])(
    'parses full IDF fixture %s end-to-end',
    async fixtureName => {
      const text = readFixture(fixtureName);
      const result = await extractPayslipFinancialEN(text, {
        sourcePath: fixtureName.includes('june')
          ? 'PaySlip2026-06.pdf'
          : fixtureName.includes('may')
            ? 'PaySlip2026-05.pdf'
            : 'PaySlip2025-03.pdf',
        expectedEmployeeName: 'שגב פרטוש',
      });

      expect(result.parties.employer_name).toBe('צבא הגנה לישראל');
      expect(result.contributions.pension.employee).toBeDefined();
      expect(result.contributions.pension.participation_total).toBeDefined();
      expect(result.contributions.pension.employer).toBeDefined();
      expect(result.contributions.study_fund.employee).toBeDefined();
      expect(result.contributions.study_fund.participation_total).toBeDefined();
      expect(result.contributions.study_fund.employer).toBeDefined();
      expect(result.contributions.pension.participation_total).toBe(
        +(result.contributions.pension.employee + result.contributions.pension.employer).toFixed(2),
      );
      expect(result.contributions.study_fund.participation_total).toBe(
        +(result.contributions.study_fund.employee + result.contributions.study_fund.employer).toFixed(2),
      );
    },
  );
});
