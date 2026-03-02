const { validateSalary, DEFAULT_MAX_GROSS } = require('../utils/validateSalary');
const { ValidationError } = require('../utils/appErrors');

describe('validateSalary', () => {
  test('net < gross -> passes', () => {
    const result = validateSalary({ grossSalary: 10000, netSalary: 7500 });
    expect(result).toEqual({ grossSalary: 10000, netSalary: 7500 });
  });

  test('net === gross -> fails', () => {
    expect(() =>
      validateSalary({ grossSalary: 5000, netSalary: 5000 })
    ).toThrow(ValidationError);
  });

  test('net > gross -> fails', () => {
    expect(() =>
      validateSalary({ grossSalary: 5000, netSalary: 6000 })
    ).toThrow(ValidationError);
  });

  test('gross negative -> fails', () => {
    expect(() =>
      validateSalary({ grossSalary: -1, netSalary: 0 })
    ).toThrow(ValidationError);
  });

  test('net negative -> fails', () => {
    expect(() =>
      validateSalary({ grossSalary: 1000, netSalary: -1 })
    ).toThrow(ValidationError);
  });

  test('edge range values -> passes', () => {
    const result = validateSalary({ grossSalary: DEFAULT_MAX_GROSS, netSalary: 0 });
    expect(result).toEqual({ grossSalary: DEFAULT_MAX_GROSS, netSalary: 0 });
  });

  test('gross above max -> fails', () => {
    expect(() =>
      validateSalary({ grossSalary: DEFAULT_MAX_GROSS + 1, netSalary: 0 })
    ).toThrow(ValidationError);
  });

  test('non-numeric values -> fails', () => {
    expect(() =>
      validateSalary({ grossSalary: 'abc', netSalary: '100' })
    ).toThrow(ValidationError);
  });
});
