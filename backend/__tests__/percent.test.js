const { normalizePercent, formatPercent } = require('../utils/percent');
const { ValidationError } = require('../utils/appErrors');

describe('percent utils', () => {
  test('normalizePercent handles "10%"', () => {
    expect(normalizePercent('10%')).toBe(0.1);
  });

  test('normalizePercent handles 10', () => {
    expect(normalizePercent(10)).toBe(0.1);
  });

  test('normalizePercent handles 0.1', () => {
    expect(normalizePercent(0.1)).toBe(0.1);
  });

  test('normalizePercent rejects invalid values', () => {
    expect(() => normalizePercent(-0.1)).toThrow(ValidationError);
    expect(() => normalizePercent('150%')).toThrow(ValidationError);
  });

  test('formatPercent formats 0.1 as 10%', () => {
    expect(formatPercent(0.1, { locale: 'en-US', precision: 0 })).toBe('10%');
  });
});
