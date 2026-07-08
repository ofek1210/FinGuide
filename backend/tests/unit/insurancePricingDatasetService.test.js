'use strict';

const path = require('path');
const {
  parsePricingCsv,
  getFairPriceRange,
  compareUserPremium,
  compareUserPolicies,
  classifyPremium,
  getSourceMetadata,
  getPricingDisclaimer,
  clearPricingCache,
} = require('../../services/insurancePricingDatasetService');

describe('insurancePricingDatasetService', () => {
  beforeEach(() => {
    clearPricingCache();
  });

  it('parsePricingCsv reads benchmark rows', () => {
    const csv = require('fs').readFileSync(
      path.join(__dirname, '../../data/insurance/pricing-benchmark.csv'),
      'utf8',
    );
    const rows = parsePricingCsv(csv);
    expect(rows.length).toBeGreaterThan(10);
    expect(rows.some(r => r.insuranceType === 'health')).toBe(true);
  });

  it('getFairPriceRange returns min/avg/max for health by age', () => {
    const range = getFairPriceRange('health', { age: 35, gender: 'male' });
    expect(range.min).toBeGreaterThan(0);
    expect(range.average).toBeGreaterThan(range.min);
    expect(range.max).toBeGreaterThanOrEqual(range.average);
    expect(range.sampleCount).toBeGreaterThan(0);
    expect(range.source.sourceName).toBeTruthy();
    expect(range.source.dataCollectionMethod).toBeTruthy();
  });

  it('compareUserPremium classifies above-market premium', () => {
    const cmp = compareUserPremium(2000, 'health', { age: 35 });
    expect(['high', 'very_high']).toContain(cmp.assessment);
    expect(cmp.fairRange.average).toBeGreaterThan(0);
    expect(cmp.monthlyDeltaVsAvg).toBeGreaterThan(0);
    expect(cmp.disclaimerEn).toMatch(/not official quotes/i);
  });

  it('compareUserPolicies maps each active policy', () => {
    const rows = compareUserPolicies(
      [
        { id: '1', type: 'health', provider: 'הראל', monthlyPremium: 200, status: 'active' },
        { id: '2', type: 'life', provider: 'מגדל', monthlyPremium: 120, status: 'cancelled' },
      ],
      { personal: { age: 40, gender: 'female', childrenCount: 1 } },
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].policyId).toBe('1');
    expect(rows[0].fairRange).toBeDefined();
  });

  it('classifyPremium handles edge cases', () => {
    expect(classifyPremium(null, { average: 100 })).toBe('unknown');
    expect(classifyPremium(50, { min: 60, average: 100, max: 150 })).toBe('low');
    expect(classifyPremium(105, { min: 60, average: 100, max: 150 })).toBe('normal');
  });

  it('getSourceMetadata exposes required fields', () => {
    const meta = getSourceMetadata();
    expect(meta).toMatchObject({
      sourceName: expect.any(String),
      sourceDate: expect.any(String),
      dataCollectionMethod: expect.any(String),
    });
    expect(meta).toHaveProperty('sourceUrl');
  });

  it('getPricingDisclaimer includes Hebrew and English text', () => {
    const d = getPricingDisclaimer();
    expect(d.he).toMatch(/הערכות/);
    expect(d.en).toMatch(/not official quotes/i);
    expect(d.source.sourceName).toBeTruthy();
  });
});
