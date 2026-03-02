const { parseNumericInput } = require('../utils/numeric');

describe('numeric parser', () => {
  test('parses ₪10,000 as thousands', () => {
    expect(parseNumericInput('₪10,000')).toBe(10000);
  });

  test('parses 10,5 as decimal', () => {
    expect(parseNumericInput('10,5')).toBe(10.5);
  });

  test('parses 1,234,567 as grouped thousands', () => {
    expect(parseNumericInput('1,234,567')).toBe(1234567);
  });

  test('parses 1.234.567,89 with comma decimal', () => {
    expect(parseNumericInput('1.234.567,89')).toBe(1234567.89);
  });

  test('parses 1,234.56 with dot decimal', () => {
    expect(parseNumericInput('1,234.56')).toBe(1234.56);
  });
});
