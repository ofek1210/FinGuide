'use strict';

/**
 * Qualifying localities income-tax credit (סעיף 11) — 2026 booklet rates.
 * Credit = min(annualWorkIncome, annualIncomeCap) × creditPercent / 100
 * Source: Monthly Deductions Booklet (לוח ניכויים) — Jan 2026 / updated Apr 2026.
 */

const path = require('path');
const fs = require('fs');

const DATA_PATH = path.join(__dirname, '../data/tax/qualifyingLocalities2026.json');

let _byNormalizedName = null;
let _taxYear = 2026;

function normalizeCityName(city) {
  if (typeof city !== 'string') return '';
  return city
    .trim()
    .toLowerCase()
    .replace(/[־–—-]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/["״']/g, '');
}

function loadIndex() {
  if (_byNormalizedName) return _byNormalizedName;
  const raw = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  const map = new Map();
  for (const row of raw) {
    if (!row?.name || !Number.isFinite(row.creditPercent) || !Number.isFinite(row.annualIncomeCap)) {
      continue;
    }
    const key = normalizeCityName(row.name);
    if (!key) continue;
    map.set(key, {
      name: row.name,
      creditPercent: row.creditPercent,
      annualIncomeCap: row.annualIncomeCap,
      taxYear: _taxYear,
    });
  }
  _byNormalizedName = map;
  return map;
}

function lookupQualifyingLocality(city) {
  const key = normalizeCityName(city);
  if (!key) return null;
  const index = loadIndex();
  if (index.has(key)) return index.get(key);
  return null;
}

/**
 * Compute annual locality income-tax credit (₪).
 * @param {string|null|undefined} city
 * @param {number|null|undefined} annualWorkIncome — gross from employment for the year
 */
function computeLocalityIncomeCredit(city, annualWorkIncome) {
  const locality = lookupQualifyingLocality(city);
  if (!locality) {
    return {
      eligible: false,
      locality: null,
      annualCredit: 0,
      taxableBase: 0,
      explanation: null,
    };
  }

  const income = Number.isFinite(annualWorkIncome) && annualWorkIncome > 0
    ? annualWorkIncome
    : null;
  const base = income == null
    ? locality.annualIncomeCap
    : Math.min(income, locality.annualIncomeCap);
  const annualCredit = Math.round((base * locality.creditPercent) / 100);

  const explanation = income == null
    ? `תושב/ת ${locality.name} זכאי/ת לזיכוי ${locality.creditPercent}% מהכנסה מיגיעה אישית עד תקרה שנתית של ₪${locality.annualIncomeCap.toLocaleString('he-IL')} (שנת מס ${locality.taxYear}).`
    : income > locality.annualIncomeCap
      ? `תושב/ת ${locality.name}: זיכוי ${locality.creditPercent}% מתוך תקרת ₪${locality.annualIncomeCap.toLocaleString('he-IL')} = ₪${annualCredit.toLocaleString('he-IL')} לשנה (הכנסה שנתית גבוהה מהתקרה).`
      : `תושב/ת ${locality.name}: זיכוי ${locality.creditPercent}% מתוך הכנסה שנתית ₪${Math.round(income).toLocaleString('he-IL')} = ₪${annualCredit.toLocaleString('he-IL')} לשנה.`;

  return {
    eligible: true,
    locality,
    annualCredit,
    taxableBase: base,
    annualWorkIncome: income,
    explanation,
  };
}

function listQualifyingLocalityNames() {
  return [...loadIndex().values()].map(v => v.name).sort((a, b) => a.localeCompare(b, 'he'));
}

module.exports = {
  normalizeCityName,
  lookupQualifyingLocality,
  computeLocalityIncomeCredit,
  listQualifyingLocalityNames,
  TAX_YEAR: _taxYear,
};
