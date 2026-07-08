'use strict';

/**
 * Parse local exports from the official health insurance calculator (מחשבון בריאות).
 * Manual export only — never call the live comparison endpoint (CAPTCHA).
 */

const fs = require('fs');
const path = require('path');

const REFERENCE_DATE = new Date('2026-07-06');

function parseDobAge(dobStr, refDate = REFERENCE_DATE) {
  const m = String(dobStr || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return null;
  const birth = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  if (Number.isNaN(birth.getTime())) return null;
  let age = refDate.getFullYear() - birth.getFullYear();
  const monthDelta = refDate.getMonth() - birth.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && refDate.getDate() < birth.getDate())) age -= 1;
  return age;
}

function ageBand(age) {
  if (age == null) return { ageMin: 18, ageMax: 120 };
  if (age < 30) return { ageMin: 18, ageMax: 29 };
  if (age < 40) return { ageMin: 30, ageMax: 39 };
  if (age < 50) return { ageMin: 40, ageMax: 49 };
  if (age < 60) return { ageMin: 50, ageMax: 59 };
  return { ageMin: 60, ageMax: 120 };
}

function parseGenderHe(text) {
  const s = String(text || '').trim();
  if (s === 'נקבה') return 'female';
  if (s === 'זכר') return 'male';
  return 'all';
}

function coverageTierFromHebrew(text) {
  const s = String(text || '').toLowerCase();
  if (s.includes('ניתוח') || s.includes('השתל') || s.includes('תרופ')) return 'enhanced';
  if (s.includes('בסיס') || s.includes('מינימ')) return 'basic';
  return 'standard';
}

function readWorkbookRows(bufferOrPath) {
  const XLSX = require('xlsx');
  const wb = Buffer.isBuffer(bufferOrPath)
    ? XLSX.read(bufferOrPath, { type: 'buffer' })
    : XLSX.readFile(bufferOrPath);
  const sheetName = wb.SheetNames.find(n => n.includes('תוצאות')) || wb.SheetNames[0];
  return XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '' });
}

/**
 * @param {string|Buffer} bufferOrPath
 * @returns {import('./insuranceHealthCalculatorImport').HealthCalculatorSample}
 */
function parseHealthResultsExport(bufferOrPath) {
  const rows = readWorkbookRows(bufferOrPath);
  let gender = 'all';
  let dob = null;
  let coverageTypes = '';
  let exportDate = null;

  for (const row of rows) {
    const label = String(row[0] || '');
    if (label.includes('מין המבוטח')) gender = parseGenderHe(row[1]);
    if (label.includes('תאריך לידה')) dob = row[1];
    if (label.includes('סוגי כיסויים')) coverageTypes = row[1];
    if (label.includes('מחשבון בריאות') && row[1]) exportDate = row[1];
  }

  const headerIdx = rows.findIndex(r => String(r[0]).trim() === 'שם החברה');
  const quotes = [];
  if (headerIdx >= 0) {
    for (let i = headerIdx + 1; i < rows.length; i++) {
      const row = rows[i];
      const provider = String(row[0] || '').trim();
      const price = Number(row[1]);
      if (!provider || !Number.isFinite(price) || price <= 0) continue;
      quotes.push({
        provider,
        monthlyPremium: price,
        serviceIndex: Number(row[2]) || null,
      });
    }
  }

  const age = parseDobAge(dob);
  return {
    gender,
    dob,
    age,
    ageBand: ageBand(age),
    coverageTypes,
    coverageTier: coverageTierFromHebrew(coverageTypes),
    exportDate,
    quotes,
    sourceFile: Buffer.isBuffer(bufferOrPath) ? null : path.basename(String(bufferOrPath)),
  };
}

function pricingRowKey(row) {
  return [
    row.insuranceType,
    row.ageMin,
    row.ageMax,
    row.gender,
    row.coverageTier,
  ].join('|');
}

/**
 * Aggregate multiple calculator exports → pricing benchmark rows.
 * With a single quote per band, expands min/max to approximate market spread.
 */
function aggregateSamplesToPricingRows(samples) {
  const groups = new Map();

  for (const sample of samples) {
    if (!sample?.quotes?.length) continue;
    const band = sample.ageBand || ageBand(sample.age);
    const key = ['health', band.ageMin, band.ageMax, sample.gender, sample.coverageTier].join('|');

    if (!groups.has(key)) {
      groups.set(key, {
        insuranceType: 'health',
        ageMin: band.ageMin,
        ageMax: band.ageMax,
        gender: sample.gender,
        coverageTier: sample.coverageTier,
        prices: [],
        providers: [],
      });
    }
    const g = groups.get(key);
    for (const q of sample.quotes) {
      g.prices.push(q.monthlyPremium);
      g.providers.push(q.provider);
    }
  }

  const rows = [];
  for (const g of groups.values()) {
    const prices = [...g.prices].sort((a, b) => a - b);
    const minObserved = prices[0];
    const maxObserved = prices[prices.length - 1];
    const avg = Math.round(prices.reduce((s, p) => s + p, 0) / prices.length);

    rows.push({
      insuranceType: g.insuranceType,
      ageMin: g.ageMin,
      ageMax: g.ageMax,
      gender: g.gender,
      coverageTier: g.coverageTier,
      monthlyMin: prices.length === 1 ? Math.max(1, Math.round(minObserved * 0.92)) : minObserved,
      monthlyAvg: avg,
      monthlyMax: prices.length === 1 ? Math.round(maxObserved * 1.65) : maxObserved,
      sampleCount: prices.length,
      source: 'health_calculator_export',
      providers: [...new Set(g.providers)],
    });
  }

  return rows;
}

function loadHealthCalculatorSamples(samplesDir) {
  if (!samplesDir || !fs.existsSync(samplesDir)) return [];

  const files = fs.readdirSync(samplesDir).filter(f => /\.xlsx?$/i.test(f));
  const samples = files.map(f => parseHealthResultsExport(path.join(samplesDir, f)));
  return aggregateSamplesToPricingRows(samples);
}

function mergePricingRows(baseRows, overrideRows) {
  const overrideKeys = new Set(overrideRows.map(pricingRowKey));
  const merged = (baseRows || []).filter(r => !overrideKeys.has(pricingRowKey(r)));
  return [...merged, ...overrideRows];
}

module.exports = {
  parseHealthResultsExport,
  aggregateSamplesToPricingRows,
  loadHealthCalculatorSamples,
  mergePricingRows,
  pricingRowKey,
  parseDobAge,
  ageBand,
  coverageTierFromHebrew,
};
