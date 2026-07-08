'use strict';

const path = require('path');
const {
  parseHealthResultsExport,
  loadHealthCalculatorSamples,
  aggregateSamplesToPricingRows,
  parseDobAge,
  ageBand,
} = require('../../services/insuranceHealthCalculatorImport');
const { clearPricingCache, getFairPriceRange } = require('../../services/insurancePricingDatasetService');

const SAMPLES_DIR = path.join(__dirname, '../../data/insurance/health-calculator-samples');

describe('insuranceHealthCalculatorImport', () => {
  beforeEach(() => clearPricingCache());

  it('parses female young export (DOB 2005 → age ~20)', () => {
    const sample = parseHealthResultsExport(
      path.join(SAMPLES_DIR, 'health-female-young-2005.xlsx'),
    );
    expect(sample.gender).toBe('female');
    expect(parseDobAge('24/10/2005')).toBe(20);
    expect(sample.ageBand).toEqual({ ageMin: 18, ageMax: 29 });
    expect(sample.coverageTier).toBe('enhanced');
    expect(sample.quotes[0]).toMatchObject({ provider: 'AIG', monthlyPremium: 22, serviceIndex: 84 });
  });

  it('parses female age-30 export (DOB 1990 → age ~35)', () => {
    const sample = parseHealthResultsExport(
      path.join(SAMPLES_DIR, 'health-female-age30-1990.xlsx'),
    );
    expect(sample.ageBand).toEqual({ ageMin: 30, ageMax: 39 });
    expect(sample.quotes[0].monthlyPremium).toBe(42);
  });

  it('parses female age-60 export (DOB 1960 → age ~65)', () => {
    const sample = parseHealthResultsExport(
      path.join(SAMPLES_DIR, 'health-female-age60-1960.xlsx'),
    );
    expect(sample.ageBand).toEqual({ ageMin: 60, ageMax: 120 });
    expect(sample.quotes[0].monthlyPremium).toBe(153);
  });

  it('aggregates three samples into female enhanced pricing bands', () => {
    const rows = loadHealthCalculatorSamples(SAMPLES_DIR);
    expect(rows.length).toBe(3);

    const young = rows.find(r => r.ageMin === 18 && r.gender === 'female');
    const mid = rows.find(r => r.ageMin === 30 && r.gender === 'female');
    const senior = rows.find(r => r.ageMin === 60 && r.gender === 'female');

    expect(young.monthlyAvg).toBe(22);
    expect(mid.monthlyAvg).toBe(42);
    expect(senior.monthlyAvg).toBe(153);
    expect(young.monthlyMin).toBeLessThanOrEqual(22);
    expect(senior.monthlyMax).toBeGreaterThan(153);
  });

  it('getFairPriceRange uses health calculator data for female enhanced', () => {
    const range = getFairPriceRange('health', {
      age: 21,
      gender: 'female',
      coverageTier: 'enhanced',
    });
    expect(range.average).toBe(22);
    expect(range.min).toBeLessThanOrEqual(22);
  });

  it('ageBand maps ages correctly', () => {
    expect(ageBand(25)).toEqual({ ageMin: 18, ageMax: 29 });
    expect(ageBand(35)).toEqual({ ageMin: 30, ageMax: 39 });
    expect(ageBand(65)).toEqual({ ageMin: 60, ageMax: 120 });
  });
});
