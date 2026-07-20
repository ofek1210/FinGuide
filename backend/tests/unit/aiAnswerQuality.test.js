/**
 * Rule-answer quality fixtures — grounded numeric checks (not just intent).
 */
const { buildRuleBasedAnswer, detectIntent } = require('../../controllers/aiController');

const SAMPLE_CTX = {
  netSalary: 12345,
  grossSalary: 20000,
  pensionEmployee: 800,
  pensionEmployer: 900,
  tax: 2100,
  findings: [
    { title: 'פער הפקדה לפנסיה', details: 'חסרה הפקדה בחודש מרץ', severity: 'warning' },
  ],
  payslipHistory: [],
};

describe('AI rule answer quality', () => {
  test('net_salary answer includes net amount', () => {
    const intent = detectIntent('כמה נטו?');
    expect(intent).toBe('net_salary');
    const answer = buildRuleBasedAnswer(intent, SAMPLE_CTX);
    expect(answer).toBeTruthy();
    expect(answer).toMatch(/12[,.]?345|12\.345/);
  });

  test('gross_salary answer includes gross amount', () => {
    const intent = detectIntent('מה הברוטו שלי?');
    expect(intent).toBe('gross_salary');
    const answer = buildRuleBasedAnswer(intent, SAMPLE_CTX);
    expect(answer).toMatch(/20[,.]?000|20\.000/);
  });

  test('recommended_action mentions findings when present', () => {
    const intent = detectIntent('מה הכי חשוב עכשיו?');
    expect(intent).toBe('recommended_action');
    const answer = buildRuleBasedAnswer(intent, SAMPLE_CTX);
    expect(answer).toContain('פער הפקדה');
  });

  test('anomaly_check references findings title', () => {
    const intent = detectIntent('יש חריגות בתלוש?');
    expect(intent).toBe('anomaly_check');
    const answer = buildRuleBasedAnswer(intent, SAMPLE_CTX);
    expect(answer).toMatch(/פער|ממצא|חריג/);
  });
});
