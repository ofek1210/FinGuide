'use strict';

/**
 * Parse synthetic calculator-like offer samples into the same benchmark-row shape
 * used by the local health calculator exports.
 */

const fs = require('fs');
const path = require('path');

function ageBand(age) {
  const n = Number(age);
  if (!Number.isFinite(n)) return { ageMin: 18, ageMax: 120 };
  if (n < 30) return { ageMin: 18, ageMax: 29 };
  if (n < 40) return { ageMin: 30, ageMax: 39 };
  if (n < 50) return { ageMin: 40, ageMax: 49 };
  if (n < 60) return { ageMin: 50, ageMax: 59 };
  return { ageMin: 60, ageMax: 120 };
}

function coverageTierFromOffer(record) {
  const type = record.insuranceType;
  const coverage = String(record.parameters?.coverageType || '').toLowerCase();
  const amount = Number(record.parameters?.coverageAmount || 0);
  const asset = Number(record.parameters?.assetValue || 0);

  if (type === 'car') {
    if (coverage.includes('mandatory_only')) return 'basic';
    if (coverage.includes('third_party')) return 'standard';
    return 'enhanced';
  }
  if (type === 'apartment') {
    if (coverage.includes('contents_only')) return 'basic';
    if (asset > 1500000 || coverage.includes('structure_contents')) return 'high_value';
    return 'standard';
  }
  if (type === 'life') {
    if (amount >= 1000000 || record.userProfile?.smoker) return 'enhanced';
    return 'standard';
  }
  if (type === 'health') {
    if (coverage.includes('basic')) return 'basic';
    if (coverage.includes('premium')) return 'enhanced';
    return 'standard';
  }
  return 'standard';
}

function groupKey(row) {
  return [
    row.insuranceType,
    row.ageMin,
    row.ageMax,
    row.gender,
    row.coverageTier,
  ].join('|');
}

function normalizeOffer(record) {
  const profile = record.userProfile || {};
  const band = ageBand(profile.age);
  return {
    insuranceType: record.insuranceType,
    ageMin: band.ageMin,
    ageMax: band.ageMax,
    gender: profile.gender || 'all',
    coverageTier: coverageTierFromOffer(record),
    monthlyPremium: Number(record.monthlyPremiumNis),
    provider: record.companyName,
  };
}

function aggregateCalculatorSamplesToPricingRows(records) {
  const groups = new Map();

  for (const record of records || []) {
    const row = normalizeOffer(record);
    if (!row.insuranceType || !Number.isFinite(row.monthlyPremium) || row.monthlyPremium <= 0) continue;
    const key = groupKey(row);
    if (!groups.has(key)) {
      groups.set(key, {
        insuranceType: row.insuranceType,
        ageMin: row.ageMin,
        ageMax: row.ageMax,
        gender: row.gender,
        coverageTier: row.coverageTier,
        prices: [],
        providers: [],
      });
    }
    const group = groups.get(key);
    group.prices.push(row.monthlyPremium);
    group.providers.push(row.provider);
  }

  return [...groups.values()].map(group => {
    const prices = [...group.prices].sort((a, b) => a - b);
    return {
      insuranceType: group.insuranceType,
      ageMin: group.ageMin,
      ageMax: group.ageMax,
      gender: group.gender,
      coverageTier: group.coverageTier,
      monthlyMin: prices[0],
      monthlyAvg: Math.round(prices.reduce((sum, price) => sum + price, 0) / prices.length),
      monthlyMax: prices[prices.length - 1],
      sampleCount: prices.length,
      source: 'synthetic_calculator_sample',
      providers: [...new Set(group.providers)],
    };
  });
}

function readCalculatorSampleRecords(samplesDir) {
  if (!samplesDir || !fs.existsSync(samplesDir)) return [];
  const records = [];
  const files = fs.readdirSync(samplesDir)
    .filter(file => /^synthetic-.+-offers\.json$/i.test(file));
  for (const file of files) {
    const parsed = JSON.parse(fs.readFileSync(path.join(samplesDir, file), 'utf8'));
    records.push(...parsed);
  }
  return records;
}

function loadCalculatorSamples(samplesDirs) {
  const dirs = Array.isArray(samplesDirs) ? samplesDirs : [samplesDirs];
  const records = dirs.flatMap(readCalculatorSampleRecords);

  return aggregateCalculatorSamplesToPricingRows(records);
}

module.exports = {
  aggregateCalculatorSamplesToPricingRows,
  ageBand,
  coverageTierFromOffer,
  loadCalculatorSamples,
  readCalculatorSampleRecords,
};
