'use strict';

const fs = require('fs');
const path = require('path');
const config = require('../config/insurancePricingDatasetConfig');
const {
  loadHealthCalculatorSamples,
  mergePricingRows,
} = require('./insuranceHealthCalculatorImport');
const { loadCalculatorSamples } = require('./insuranceCalculatorSampleImport');

let cache = { rows: null, loadedAt: 0, file: null };

const SALARY_MID = {
  under_5k: 4000,
  '5k_10k': 7500,
  '10k_15k': 12500,
  '15k_20k': 17500,
  '20k_30k': 25000,
  '30k_50k': 40000,
  above_50k: 60000,
};

function normalizeGender(g) {
  if (!g) return 'all';
  const s = String(g).toLowerCase();
  if (s === 'male' || s === 'female') return s;
  return 'all';
}

function coverageTierFromAmount(type, coverageAmount) {
  if (coverageAmount == null || coverageAmount <= 0) return 'standard';
  if (type === 'apartment' && coverageAmount > 1_500_000) return 'high_value';
  if (type === 'health' && coverageAmount > 500_000) return 'enhanced';
  if (type === 'health' && coverageAmount < 200_000) return 'basic';
  return 'standard';
}

function parsePricingCsv(text) {
  const lines = String(text || '').split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const idx = name => headers.indexOf(name);

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(',').map(c => c.trim());
    if (cells.length < 7) continue;
    const get = n => (idx(n) >= 0 ? cells[idx(n)] : cells[n]);

    rows.push({
      insuranceType: get('insurance_type'),
      ageMin: Number(get('age_min')) || 0,
      ageMax: Number(get('age_max')) || 120,
      gender: normalizeGender(get('gender')),
      coverageTier: get('coverage_tier') || 'standard',
      monthlyMin: Number(get('monthly_min')) || 0,
      monthlyAvg: Number(get('monthly_avg')) || 0,
      monthlyMax: Number(get('monthly_max')) || 0,
    });
  }
  return rows.filter(r => r.insuranceType && r.monthlyAvg > 0);
}

function tryLoadXlsx(filePath) {
  try {
    const XLSX = require('xlsx');
    if (!fs.existsSync(filePath)) return null;
    const wb = XLSX.readFile(filePath);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const csv = XLSX.utils.sheet_to_csv(sheet);
    return parsePricingCsv(csv);
  } catch {
    return null;
  }
}

function loadPricingDataset({ forceReload = false } = {}) {
  if (!forceReload && cache.rows && Date.now() - cache.loadedAt < 60 * 60 * 1000) {
    return { rows: cache.rows, sourceFile: cache.file };
  }

  const csvPath = path.join(config.dataDir, config.pricingCsvFile);
  const xlsxPath = path.join(config.dataDir, config.pricingXlsxFile);

  let rows = null;
  let file = null;

  if (fs.existsSync(csvPath)) {
    rows = parsePricingCsv(fs.readFileSync(csvPath, 'utf8'));
    file = csvPath;
  }
  if ((!rows || rows.length === 0) && fs.existsSync(xlsxPath)) {
    rows = tryLoadXlsx(xlsxPath);
    file = xlsxPath;
  }

  if (!rows?.length) {
    throw new Error(`Insurance pricing dataset not found in ${config.dataDir}`);
  }

  const samplesDir = path.join(config.dataDir, config.healthCalculatorSamplesDir);
  const healthRows = loadHealthCalculatorSamples(samplesDir);
  if (healthRows.length) {
    rows = mergePricingRows(rows, healthRows);
    file = `${file}+${samplesDir}`;
  }

  const calculatorSampleDirs = config.calculatorSampleDirs.map(dir => path.join(config.dataDir, dir));
  const calculatorRows = loadCalculatorSamples(calculatorSampleDirs);
  if (calculatorRows.length) {
    rows = mergePricingRows(rows, calculatorRows);
    file = `${file}+${calculatorSampleDirs.join('+')}`;
  }

  cache = { rows, loadedAt: Date.now(), file };
  return { rows, sourceFile: file };
}

function matchRows(rows, kind, { age, gender, coverageTier }) {
  const g = normalizeGender(gender);
  const tier = coverageTier || null;
  const ageNum = age != null ? Number(age) : null;

  return rows.filter(r => {
    if (r.insuranceType !== kind) return false;
    if (ageNum != null && (ageNum < r.ageMin || ageNum > r.ageMax)) return false;
    if (tier && r.coverageTier !== tier) return false;
    if (r.gender !== 'all' && g !== 'all' && r.gender !== g) return false;
    return true;
  });
}

function aggregateRange(matched) {
  if (!matched.length) return null;
  return {
    min: Math.min(...matched.map(r => r.monthlyMin)),
    average: Math.round(matched.reduce((s, r) => s + r.monthlyAvg, 0) / matched.length),
    max: Math.max(...matched.map(r => r.monthlyMax)),
    currency: 'ILS',
    sampleCount: matched.length,
  };
}

function distanceFromBand(age, row) {
  if (age == null || !Number.isFinite(age)) return 0;
  if (age >= row.ageMin && age <= row.ageMax) return 0;
  return Math.min(Math.abs(age - row.ageMin), Math.abs(age - row.ageMax));
}

function nearestRowsByAge(rows, kind, { age, gender, coverageTier }) {
  const ageNum = age != null ? Number(age) : null;
  if (ageNum == null || !Number.isFinite(ageNum)) return [];

  const g = normalizeGender(gender);
  let candidates = rows.filter(r =>
    r.insuranceType === kind
    && (!coverageTier || r.coverageTier === coverageTier)
    && (r.gender === 'all' || g === 'all' || r.gender === g),
  );

  if (g !== 'all') {
    const genderSpecific = candidates.filter(r => r.gender === g);
    if (genderSpecific.length) candidates = genderSpecific;
  }
  if (!candidates.length) return [];

  const minDistance = Math.min(...candidates.map(row => distanceFromBand(ageNum, row)));
  return candidates.filter(row => distanceFromBand(ageNum, row) === minDistance);
}

/**
 * Fair price range from local dataset — normalized by age, gender, type, coverage tier.
 */
function getFairPriceRange(kind, {
  age,
  gender,
  coverageAmount,
  coverageTier,
  grossMonthly,
  salaryRange,
  childrenCount,
} = {}) {
  const { rows } = loadPricingDataset();
  const tier = coverageTier || coverageTierFromAmount(kind, coverageAmount);
  let effectiveTier = tier;

  let matched = matchRows(rows, kind, { age, gender, coverageTier: tier });
  const g = normalizeGender(gender);
  if (g !== 'all') {
    const genderSpecific = matched.filter(r => r.gender === g);
    if (genderSpecific.length) matched = genderSpecific;
  }
  if (!matched.length && tier !== 'standard') {
    matched = nearestRowsByAge(rows, kind, { age, gender, coverageTier: tier });
  }
  if (!matched.length) {
    matched = matchRows(rows, kind, { age, gender: 'all', coverageTier: 'standard' });
    effectiveTier = 'standard';
  }
  if (!matched.length && tier !== 'standard') {
    matched = matchRows(rows, kind, { age, gender, coverageTier: null });
    effectiveTier = 'mixed';
  }
  if (!matched.length) {
    matched = rows.filter(r => r.insuranceType === kind && r.gender === 'all' && r.coverageTier === 'standard');
    effectiveTier = 'standard';
  }

  let range = aggregateRange(matched);
  if (!range) {
    return { min: 0, average: 0, max: 0, currency: 'ILS', sampleCount: 0 };
  }

  let multiplier = 1;
  const gross = grossMonthly ?? (salaryRange ? SALARY_MID[salaryRange] : null);
  if (gross != null) {
    if (gross < 10000) multiplier *= 0.92;
    else if (gross > 35000) multiplier *= 1.12;
  }
  if (kind === 'life' && childrenCount > 0) {
    multiplier *= 1 + childrenCount * 0.08;
  }

  if (multiplier !== 1) {
    range = {
      ...range,
      min: Math.round(range.min * multiplier),
      average: Math.round(range.average * multiplier),
      max: Math.round(range.max * multiplier),
    };
  }

  return {
    ...range,
    coverageTier: effectiveTier,
    requestedCoverageTier: tier,
    source: getSourceMetadata(),
  };
}

function classifyPremium(monthlyPremium, range) {
  if (monthlyPremium == null || !range?.average) return 'unknown';
  if (monthlyPremium <= range.min) return 'low';
  if (monthlyPremium <= range.average * 1.08) return 'normal';
  if (monthlyPremium <= range.max) return 'high';
  return 'very_high';
}

function compareUserPremium(monthlyPremium, kind, profileCtx = {}) {
  const range = getFairPriceRange(kind, profileCtx);
  const assessment = classifyPremium(monthlyPremium, range);
  const monthlyDeltaVsAvg = monthlyPremium != null && range.average
    ? Math.round(monthlyPremium - range.average)
    : null;

  return {
    userMonthlyPremium: monthlyPremium,
    fairRange: range,
    assessment,
    monthlyDeltaVsAvg,
    annualDeltaVsAvg: monthlyDeltaVsAvg != null ? monthlyDeltaVsAvg * 12 : null,
    source: getSourceMetadata(),
    disclaimer: config.disclaimerHe,
    disclaimerEn: config.disclaimerEn,
  };
}

function compareUserPolicies(policies, profileDTO = {}) {
  const personal = profileDTO.personal || {};
  const financial = profileDTO.financial || {};
  const employment = profileDTO.employment || {};
  const ctx = {
    age: personal.age,
    gender: personal.gender,
    childrenCount: personal.childrenCount,
    salaryRange: financial.salaryRange,
    grossMonthly: employment.expectedMonthlyGross,
  };

  return (policies || [])
    .filter(p => p.status !== 'cancelled' && p.status !== 'expired')
    .map(p => ({
      policyId: p.id,
      type: p.type,
      provider: p.provider,
      ...compareUserPremium(p.monthlyPremium, p.type, {
        ...ctx,
        coverageAmount: p.coverageAmount,
      }),
    }));
}

function getSourceMetadata() {
  return { ...config.sourceMetadata };
}

function getPricingDisclaimer() {
  return {
    he: config.disclaimerHe,
    en: config.disclaimerEn,
    source: getSourceMetadata(),
  };
}

function clearPricingCache() {
  cache = { rows: null, loadedAt: 0, file: null };
}

module.exports = {
  loadPricingDataset,
  parsePricingCsv,
  getFairPriceRange,
  compareUserPremium,
  compareUserPolicies,
  classifyPremium,
  getSourceMetadata,
  getPricingDisclaimer,
  clearPricingCache,
  coverageTierFromAmount,
};
