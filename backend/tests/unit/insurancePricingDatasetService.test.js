'use strict';

const {
  getFairPriceRange,
  compareUserPremium,
  buildPricingComparisons,
  getSourceMetadata,
} = require('../../services/insurancePricingDatasetService');

describe('insurancePricingDatasetService — premium benchmarking disabled', () => {
  it('getFairPriceRange returns null (no market estimate)', () => {
    expect(getFairPriceRange('health', { age: 35, gender: 'male' })).toBeNull();
  });

  it('compareUserPremium does not classify above/below market', () => {
    const cmp = compareUserPremium(2000, 'health', { age: 35 });
    expect(cmp.fairRange).toBeNull();
    expect(cmp.assessment).toBe('unavailable');
    expect(cmp.premiumVsMarket).toBeNull();
  });

  it('buildPricingComparisons returns empty', () => {
    expect(buildPricingComparisons([{ type: 'health', monthlyPremium: 200 }], { age: 35 })).toEqual([]);
  });

  it('getSourceMetadata returns null', () => {
    expect(getSourceMetadata()).toBeNull();
  });
});
