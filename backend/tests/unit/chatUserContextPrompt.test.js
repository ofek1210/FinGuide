const { appendUserFinancialContext } = require('../../services/chatUserContextPrompt');

describe('chatUserContextPrompt', () => {
  it('appends payslip, history, and domain analysis blocks', () => {
    const lines = ['header'];
    appendUserFinancialContext(lines, {
      grossSalary: 20000,
      netSalary: 14500,
      employerName: 'Acme',
      taxCreditPoints: 2.25,
      payslipHistory: [{ date: '2026-04', grossSalary: 19500, netSalary: 14000 }],
      pensionAnalysis: {
        hasData: true,
        healthScore: 80,
        topRecs: ['בדוק דמי ניהול'],
      },
      insuranceAnalysis: {
        hasData: true,
        healthScore: 55,
        duplicateCount: 2,
        topRecs: ['אחד ביטוח בריאות'],
      },
    }, { headingStyle: 'section' });

    const text = lines.join('\n');
    expect(text).toContain('Acme');
    expect(text).toContain('נקודות זיכוי: 2.25');
    expect(text).toContain('2026-04');
    expect(text).toContain('ציון בריאות פנסיונית: 80/100');
    expect(text).toContain('כפילויות ביטוח: 2');
  });
});
