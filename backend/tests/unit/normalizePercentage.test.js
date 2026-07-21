'use strict';

const { normalizePercentage, normalizeExposurePercent } = require('../../utils/normalizePercentage');

describe('normalizePercentage', () => {
  it('converts decimal fractions to percent scale', () => {
    expect(normalizePercentage(0.41)).toEqual({ value: 41, valid: true, raw: 0.41 });
  });

  it('leaves values already on percent scale unchanged', () => {
    expect(normalizePercentage(41)).toEqual({ value: 41, valid: true, raw: 41 });
  });

  it('parses string percentages', () => {
    expect(normalizePercentage('41%')).toEqual({ value: 41, valid: true, raw: '41%' });
    expect(normalizePercentage('41.0')).toEqual({ value: 41, valid: true, raw: '41.0' });
  });

  it('handles null and empty as invalid', () => {
    expect(normalizePercentage(null).valid).toBe(false);
    expect(normalizePercentage('').valid).toBe(false);
  });

  it('rejects values above 100 percent', () => {
    expect(normalizePercentage(303.041).valid).toBe(false);
    expect(normalizePercentage(30304.1).valid).toBe(false);
  });
});

describe('normalizeExposurePercent', () => {
  it('derives percent from absolute exposure and total assets', () => {
    const result = normalizeExposurePercent(41, 100);
    expect(result.valid).toBe(true);
    expect(result.value).toBe(41);
  });
});
