const { detectSalaryAnomalies, DEFAULTS } = require('../utils/detectSalaryAnomalies');

describe('detectSalaryAnomalies', () => {
  test('no anomalies', () => {
    const result = detectSalaryAnomalies({ grossSalary: 12_000, netSalary: 7_500 });
    expect(result.hasAnomalies).toBe(false);
    expect(result.anomalies).toHaveLength(0);
  });

  test('single anomaly: net too close to gross', () => {
    const result = detectSalaryAnomalies({ grossSalary: 10_000, netSalary: 9_500 });
    expect(result.hasAnomalies).toBe(true);
    expect(result.anomalies.map(item => item.code)).toContain('NET_TOO_CLOSE_TO_GROSS');
  });

  test('multiple anomalies', () => {
    const result = detectSalaryAnomalies({ grossSalary: 100_000, netSalary: 100_000 });
    expect(result.hasAnomalies).toBe(true);
    const codes = result.anomalies.map(item => item.code);
    expect(codes).toContain('NET_TOO_CLOSE_TO_GROSS');
    expect(codes).toContain('GROSS_UNUSUALLY_HIGH');
    expect(codes).toContain('ZERO_DEDUCTIONS');
    expect(codes).toContain('GROSS_SUSPICIOUSLY_ROUND');
  });

  test('edge: low gross triggers low flag', () => {
    const result = detectSalaryAnomalies({
      grossSalary: DEFAULTS.lowGrossThreshold - 1,
      netSalary: 500,
    });
    expect(result.anomalies.map(item => item.code)).toContain('GROSS_UNUSUALLY_LOW');
  });

  test('edge: round gross only when above minimum', () => {
    const result = detectSalaryAnomalies({
      grossSalary: DEFAULTS.minRoundCheck - DEFAULTS.roundIncrement,
      netSalary: 1000,
    });
    expect(result.anomalies.map(item => item.code)).not.toContain('GROSS_SUSPICIOUSLY_ROUND');
  });

  test('non-numeric values -> returns invalid input anomaly', () => {
    const result = detectSalaryAnomalies({ grossSalary: 'abc', netSalary: 1000 });
    expect(result.hasAnomalies).toBe(true);
    expect(result.anomalies[0].code).toBe('INVALID_SALARY_INPUT');
  });
});
