'use strict';

const fs = require('fs');
const path = require('path');
const { buildRecords } = require('../../scripts/generateInsuranceCalculatorSamples');
const {
  aggregateCalculatorSamplesToPricingRows,
  ageBand,
  loadCalculatorSamples,
} = require('../../services/insuranceCalculatorSampleImport');

const DATA_DIR = path.join(__dirname, '../../data/insurance');
const SAMPLE_DIRS = [
  'car-calculator-samples',
  'apartment-calculator-samples',
  'life-calculator-samples',
  'health-calculator-samples',
].map(dir => path.join(DATA_DIR, dir));

function loadSplitData() {
  return ['car', 'apartment', 'life', 'health'].flatMap(type => {
    const file = path.join(DATA_DIR, `${type}-calculator-samples`, `synthetic-${type}-offers.json`);
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  });
}

function average(records) {
  return records.reduce((sum, r) => sum + r.monthlyPremiumNis, 0) / records.length;
}

function byType(records, type) {
  return records.filter(r => r.insuranceType === type);
}

describe('synthetic insurance calculator samples', () => {
  const generated = buildRecords();
  const data = loadSplitData();

  it('generates 50 records per insurance type across all pricing age bands', () => {
    expect(data).toHaveLength(200);
    expect(byType(data, 'car')).toHaveLength(50);
    expect(byType(data, 'apartment')).toHaveLength(50);
    expect(byType(data, 'life')).toHaveLength(50);
    expect(byType(data, 'health')).toHaveLength(50);
  });

  it('keeps generated JSON in sync with the deterministic generator', () => {
    expect(data).toEqual(generated);
  });

  it('uses only synthetic calculator sample metadata', () => {
    expect(data.every(r => r.dataSourceType === 'synthetic_calculator_sample')).toBe(true);
    expect(data.every(r => r.isRealQuote === false)).toBe(true);
    expect(data.every(r => r.basedOn === 'Simulated from official Israeli insurance calculator logic')).toBe(true);
  });

  it('keeps car age pricing trend logical', () => {
    const car = byType(data, 'car').filter(r =>
      r.parameters.coverageType === 'comprehensive_mandatory',
    );
    const age18 = average(car.filter(r => r.userProfile.age === 18));
    const age40 = average(car.filter(r => r.userProfile.age === 40));
    const age70 = average(car.filter(r => r.userProfile.age === 70));

    expect(age18).toBeGreaterThan(age70);
    expect(age70).toBeGreaterThan(age40);
  });

  it('keeps life smoker and age pricing trends logical', () => {
    const life500k = byType(data, 'life').filter(r =>
      r.parameters.coverageAmount === 500000,
    );
    const nonSmoker18 = average(life500k.filter(r => r.userProfile.age === 18 && !r.userProfile.smoker));
    const nonSmoker40 = average(life500k.filter(r => r.userProfile.age === 40 && !r.userProfile.smoker));
    const nonSmoker70 = average(life500k.filter(r => r.userProfile.age === 70 && !r.userProfile.smoker));
    const smoker40 = average(life500k.filter(r => r.userProfile.age === 40 && r.userProfile.smoker));

    expect(nonSmoker40).toBeGreaterThan(nonSmoker18);
    expect(nonSmoker70).toBeGreaterThan(nonSmoker40);
    expect(smoker40).toBeGreaterThan(nonSmoker40);
  });

  it('includes samples for every pricing age band', () => {
    for (const type of ['car', 'apartment', 'life', 'health']) {
      const ages = new Set(byType(data, type).map(record => record.userProfile.age));
      expect([...ages].sort((a, b) => a - b)).toEqual([18, 30, 40, 55, 70]);
    }
  });

  it('keeps all scores bounded and yearly premiums consistent', () => {
    data.forEach(record => {
      expect(record.score).toBeGreaterThanOrEqual(1);
      expect(record.score).toBeLessThanOrEqual(100);
      expect(record.yearlyPremiumNis).toBe(record.monthlyPremiumNis * 12);
    });
  });

  it('aggregates calculator samples into the pricing benchmark row structure', () => {
    const rows = aggregateCalculatorSamplesToPricingRows(data);
    expect(rows.length).toBeGreaterThan(12);
    expect(rows[0]).toMatchObject({
      insuranceType: expect.any(String),
      ageMin: expect.any(Number),
      ageMax: expect.any(Number),
      gender: expect.any(String),
      coverageTier: expect.any(String),
      monthlyMin: expect.any(Number),
      monthlyAvg: expect.any(Number),
      monthlyMax: expect.any(Number),
      source: 'synthetic_calculator_sample',
    });
    expect(rows.some(r => r.insuranceType === 'car' && r.coverageTier === 'enhanced')).toBe(true);
    expect(rows.some(r => r.insuranceType === 'apartment' && r.coverageTier === 'high_value')).toBe(true);
    expect(rows.some(r => r.insuranceType === 'life' && r.coverageTier === 'enhanced')).toBe(true);
    expect(rows.some(r => r.insuranceType === 'health' && r.coverageTier === 'basic')).toBe(true);
  });

  it('loads calculator samples from type-specific folders like health calculator samples', () => {
    const rows = loadCalculatorSamples(SAMPLE_DIRS);
    expect(rows.length).toBeGreaterThan(12);
    expect(rows.every(row => row.monthlyAvg >= row.monthlyMin)).toBe(true);
    expect(rows.every(row => row.monthlyMax >= row.monthlyAvg)).toBe(true);
  });

  it('maps ages to the same bands as the health calculator importer', () => {
    expect(ageBand(26)).toEqual({ ageMin: 18, ageMax: 29 });
    expect(ageBand(35)).toEqual({ ageMin: 30, ageMax: 39 });
    expect(ageBand(45)).toEqual({ ageMin: 40, ageMax: 49 });
    expect(ageBand(55)).toEqual({ ageMin: 50, ageMax: 59 });
    expect(ageBand(70)).toEqual({ ageMin: 60, ageMax: 120 });
  });
});
