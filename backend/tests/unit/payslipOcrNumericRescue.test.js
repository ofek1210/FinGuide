const { rescueFromLayoutText } = require('../../services/payslipOcrNumericRescue');

describe('payslipOcrNumericRescue', () => {
  it('extracts gross/net from garbled layout text', () => {
    const text = [
      'header garbage',
      '26,000.00         label garbage',
      '7,294.00         more garbage',
      '2,575.25',
      '16,130.75                 net label garbage',
    ].join('\n');

    const result = rescueFromLayoutText(text);
    expect(result).not.toBeNull();
    expect(result.gross_total).toBe(26000);
    expect(result.net_payable).toBe(16130.75);
    expect(result.income_tax).toBe(7294);
    expect(result.national_insurance).toBe(2575.25);
    expect(result.mandatory_total).toBe(9869.25);
  });
});
