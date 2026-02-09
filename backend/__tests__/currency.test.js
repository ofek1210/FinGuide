const { normalizeCurrency, formatCurrency } = require('../utils/currency');
const { ValidationError } = require('../utils/appErrors');

describe('currency utils', () => {
  test('normalizeCurrency handles ₪10,000', () => {
    expect(normalizeCurrency('₪10,000')).toEqual({ amount: 10000, currency: 'ILS' });
  });

  test('normalizeCurrency handles $100', () => {
    expect(normalizeCurrency('$100')).toEqual({ amount: 100, currency: 'USD' });
  });

  test('normalizeCurrency handles 100 EUR', () => {
    expect(normalizeCurrency('100 EUR')).toEqual({ amount: 100, currency: 'EUR' });
  });

  test('normalizeCurrency rejects missing currency', () => {
    expect(() => normalizeCurrency('100')).toThrow(ValidationError);
  });

  test('formatCurrency returns formatted value', () => {
    const formatted = formatCurrency(10000, 'ILS', { locale: 'en-US', precision: 0 });
    expect(formatted).toContain('₪');
    expect(formatted).toContain('10,000');
  });
});
