/**
 * Payslip OCR – central label map + generic line-based extraction.
 *
 * One place to add label variants for any payslip format. The extractor walks
 * each line, matches line text to the label map, and assigns the line's
 * amount to the corresponding field. No per-payslip regex logic needed.
 *
 * @module payslipOcrLabelMap
 */

const {
  extractAllNumericTokens,
  extractOrderedNumericTokens,
} = require('./payslipOcrNumbers');

// ---------------------------------------------------------------------------
// Label map: field key → array of patterns (string or RegExp)
// String = normalized line must include this substring (case-insensitive for LTR).
// RegExp = line must match.
// Order of fields below is the priority when a line matches multiple labels.
// ---------------------------------------------------------------------------

const PAYSLIP_LABEL_MAP = {
  gross_total: [
    'סך כל התשלומים',
    'סך תשלומים',
    'ברוטו שוטף',
    "סה''כ תשלומים שוטף",
    'סה"כ תשלומים שוטף',
    "סך-כל התשלומים",
    "סה''כ תשלומים",
    'סה"כ תשלומים',
    'שכר ברוטו',
    'סה"כ ברוטו',
    'שכר לקצבה',
    /סך[-\s]?כל\s*התשלומים/i,
    /סך\s*תשלומים/i,
    /ברוטו\s*שוטף/i,
    /סה['"]?כ\s*תשלומים/i,
    /שכר\s*ברוטו/i,
    /Gross\s*(?:Salary|Total)?/i,
    /Total\s*Gross/i,
  ],
  // Do NOT match "ברוטו למס הכנסה" (taxable base) for gross_total
  _gross_total_exclude: [/ברוטו\s*למס/i, /למס\s*הכנסה/i],

  net_payable: [
    'סכום בבנק',
    'סכום בבנק בש"ח',
    'נטו לתשלום',
    'שכר נטו לתשלום',
    'שכר נטו',
    'סה"כ לתשלום',
    "סה''כ לתשלום",
    'לתשלום',
    /סכום\s*בבנק/i,
    /נטו\s*לתשלום/i,
    /שכר\s*נטו/i,
    /Net\s*(?:Salary|Pay|Payable)?/i,
    /Take\s*Home/i,
    /לתשלום\s*\d/i,
  ],

  mandatory_total: [
    'ניכויי חובה',
    'סה"כ ניכויים שוטף',
    "סה''כ ניכויים שוטף",
    'כל הניכויים',
    'סה"כ ניכויים',
    "סה''כ ניכויים",
    'סה"כ ניכוי',
    /ניכויי\s*חובה/i,
    /סה["״]?כ\s*ניכויים\s*שוטף/i,
    /כל\s*הניכו\w*/i,
    /סה["״]?כ\s*ניכו\w*/i,
    /Total\s*Deductions/i,
  ],
  _mandatory_total_exclude: [/מצטבר/i, /cumulative/i],

  income_tax: [
    'מס הכנסה',
    'מס income',
    /מס\s*הכנסה/i,
    /income\s+tax/i,
  ],
  _income_tax_exclude: [/ברוטו\s*למס/i, /הכנסה\s*חייבת/i, /מצטבר/i, /cumulative/i],

  national_insurance: [
    'ביטוח לאומי',
    'ב.ל.',
    'בל ',
    'ב.לאומי',
    'בט. לאומי',
    /ביטוח\s*לאומי/i,
    /national\s+insurance/i,
    /\bב\.?\s*ל\.?/i,
    /בט\.\s*לאומי/i,
    /ב\.לאומי/i,
  ],
  _national_insurance_exclude: [/מצטבר/i, /cumulative/i],

  health_insurance: [
    'ביטוח בריאות',
    'מס בריאות',
    /ביטוח\s*בריאות/i,
    /מס\s*בריאות/i,
    /health\s+insurance/i,
  ],
  _health_insurance_exclude: [/מצטבר/i, /cumulative/i],

  base_salary: [
    'שכר בסיס',
    /שכר\s*בסיס/i,
    /Base\s*Salary/i,
  ],

  global_overtime: [
    'ש. נוס. גלובלי',
    'שעות נוספות גלובל',
    /ש\.?\s*נוס\.?\s*גלובל/i,
    /overtime/i,
  ],

  travel_expenses: [
    'החזר הוצאות',
    'דמי נסיעה',
    'נסיעות',
    /החזר\s*הוצאות/i,
    /דמי\s*נסיעה/i,
    /נסיעות/i,
    /travel/i,
  ],

  bonus: [
    'בונוס',
    'מענק',
    'פרמיה',
    /בונוס/i,
    /מענק/i,
    /פרמיה/i,
    /bonus/i,
  ],

  holiday_pay: [
    'דמי חגים',
    'חג',
    /דמי\s*חגים/i,
    /\bחג\b/i,
    /holiday\s*pay/i,
  ],

  overtime_125: [
    'ש.נוס 125%',
    'שעות נוספות 125',
    /ש\.?\s*נוס\.?\s*125/i,
    /שעות\s*נוספות\s*125/i,
  ],

  overtime_150: [
    'ש.נוס 150%',
    'שעות נוספות 150',
    /ש\.?\s*נוס\.?\s*150/i,
    /שעות\s*נוספות\s*150/i,
  ],

  convalescence: [
    'דמי הבראה',
    'הבראה',
    /דמי\s*הבראה/i,
    /הבראה/i,
    /convalescence/i,
  ],

  clothing_allowance: [
    'ביגוד',
    /ביגוד/i,
    /clothing/i,
  ],
};

/** Field order: first match wins when a line matches multiple labels. */
const FIELD_ORDER = [
  'gross_total',
  'net_payable',
  'mandatory_total',
  'income_tax',
  'national_insurance',
  'health_insurance',
  'base_salary',
  'global_overtime',
  'travel_expenses',
  'bonus',
  'holiday_pay',
  'overtime_125',
  'overtime_150',
  'convalescence',
  'clothing_allowance',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeLine(line) {
  if (!line || typeof line !== 'string') return '';
  return line
    .replace(/\s+/g, ' ')
    .replace(/[''`׳]/g, "'")
    .replace(/[""״]/g, '"')
    .trim();
}

function lineMatchesPattern(normalizedLine, pattern) {
  if (typeof pattern === 'string') {
    const p = normalizeLine(pattern);
    const n = normalizedLine;
    return n.includes(p) || (p.length > 2 && n.toLowerCase && n.toLowerCase().includes(p.toLowerCase()));
  }
  if (pattern instanceof RegExp) {
    return pattern.test(normalizedLine);
  }
  return false;
}

function lineMatchesExclude(normalizedLine, fieldKey) {
  const exclude = PAYSLIP_LABEL_MAP[`_${fieldKey}_exclude`];
  if (!exclude || !Array.isArray(exclude)) return false;
  return exclude.some(p => lineMatchesPattern(normalizedLine, p));
}

/**
 * Extract all numeric amounts from a line (handles concatenated table cells like "231.660.00173.884,072.05").
 * @returns {number[]} Amounts in valid range, preserving order
 */
function extractAllAmountsFromLine(line, { min = 50, max = 200000 } = {}) {
  return extractAllNumericTokens(line).filter(value => value >= min && value <= max);
}

/**
 * Extract amounts from a line in column order, including zeros (for table row mapping).
 * Splits by whitespace and parses each token as number.
 * @returns {number[]} Numbers in order, or empty if line doesn't look like a data row
 */
function extractOrderedAmountsFromLine(line) {
  return extractOrderedNumericTokens(line);
}

/**
 * Split a header line into cells (tab or multi-space separated).
 * @returns {string[]} Trimmed cells
 */
function splitHeaderCells(line) {
  const raw = String(line).trim();
  if (!raw) return [];
  if (raw.includes('\t')) return raw.split(/\t+/).map(c => c.trim()).filter(Boolean);
  return raw.split(/\s{2,}/).map(c => c.trim()).filter(Boolean);
}

function extractAmountFromLine(line, { min = 50, max = 200000 } = {}) {
  const nums = extractAllAmountsFromLine(line, { min, max });
  if (!nums.length) return undefined;
  return Math.max(...nums);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Extract numeric fields from payslip lines using the central label map.
 * 1) Same-line: label + amount on one line.
 * 2) Adjacent-line: label on line i, single amount on i+1 or i-1 (table layout).
 * 3) Table row: line with multiple amounts, previous line has headers → assign gross/base/mandatory from amounts.
 *
 * @param {string[]} lines - Non-empty trimmed lines of OCR/full text
 * @returns {Record<string, number>} Map of field key → amount (only keys that were found)
 */
/* eslint-disable no-plusplus, no-continue, no-restricted-syntax */
function extractFromLinesByLabelMap(lines) {
  const result = {};
  if (!Array.isArray(lines) || !lines.length) return result;

  const usedLineIndices = new Set();

  const DEDUCTION_MAX = 15000;
  const isReasonableDeduction = (fieldKey, amt) =>
    amt <= DEDUCTION_MAX || !['income_tax', 'national_insurance', 'health_insurance', 'mandatory_total'].includes(fieldKey);

  // ---- Pass 1: same line (label + amount on one line) ----
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const normalized = normalizeLine(line);
    const amount = extractAmountFromLine(line);
    if (amount === undefined) continue;

    for (const fieldKey of FIELD_ORDER) {
      if (result[fieldKey] !== undefined) continue;
      if (!isReasonableDeduction(fieldKey, amount)) continue;
      const patterns = PAYSLIP_LABEL_MAP[fieldKey];
      if (!patterns) continue;
      if (!patterns.some(p => lineMatchesPattern(normalized, p))) continue;
      if (lineMatchesExclude(normalized, fieldKey)) continue;

      result[fieldKey] = amount;
      usedLineIndices.add(i);
      break;
    }
  }

  // ---- Pass 1b: amount-before-label (Michpal format: "24.00ב.לאומי") ----
  for (let i = 0; i < lines.length; i++) {
    if (usedLineIndices.has(i)) continue;
    const line = lines[i];
    const normalized = normalizeLine(line);

    for (const fieldKey of FIELD_ORDER) {
      if (result[fieldKey] !== undefined) continue;
      const patterns = PAYSLIP_LABEL_MAP[fieldKey];
      if (!patterns) continue;
      if (!patterns.some(p => lineMatchesPattern(normalized, p))) continue;
      if (lineMatchesExclude(normalized, fieldKey)) continue;

      // Try extracting a leading amount (e.g. "185.00מס בריאות")
      const leadingMatch = normalized.match(/^(\d[\d,.]*)/);
      if (leadingMatch) {
        const tokens = extractAllNumericTokens(leadingMatch[1]);
        const limits = { income_tax: 0, national_insurance: 0, health_insurance: 0 };
        const minVal = limits[fieldKey] !== undefined ? limits[fieldKey] : 50;
        const filtered = tokens.filter(v => v >= minVal && v <= 200000);
        if (filtered.length > 0 && isReasonableDeduction(fieldKey, filtered[0])) {
          result[fieldKey] = filtered[0];
          usedLineIndices.add(i);
          break;
        }
      }
    }
  }

  // ---- Pass 2: adjacent / nearby line (label on i, amount on i±1..i±5) ----
  const ADJACENT_WINDOW = 5;
  for (let i = 0; i < lines.length; i++) {
    if (usedLineIndices.has(i)) continue;
    const normalized = normalizeLine(lines[i]);
    const amountOnLine = extractAmountFromLine(lines[i]);
    if (amountOnLine !== undefined) continue;

    for (const fieldKey of FIELD_ORDER) {
      if (result[fieldKey] !== undefined) continue;
      const patterns = PAYSLIP_LABEL_MAP[fieldKey];
      if (!patterns || !patterns.some(p => lineMatchesPattern(normalized, p))) continue;
      if (lineMatchesExclude(normalized, fieldKey)) continue;

      let chosenAmount;
      let chosenIdx;
      for (let d = 1; d <= ADJACENT_WINDOW; d++) {
        for (const sign of [1, -1]) {
          const j = i + sign * d;
          if (j < 0 || j >= lines.length || usedLineIndices.has(j)) continue;
          const nums = extractAllAmountsFromLine(lines[j]);
          if (nums.length !== 1) continue;
          const amt = nums[0];
          if (fieldKey === 'net_payable' && amt >= 1000 && amt <= 100000) {
            chosenAmount = amt;
            chosenIdx = j;
            break;
          }
          if (fieldKey !== 'net_payable' && amt >= 50 && amt <= 200000 && isReasonableDeduction(fieldKey, amt)) {
            chosenAmount = amt;
            chosenIdx = j;
            break;
          }
        }
        if (chosenAmount !== undefined) break;
      }

      if (chosenAmount !== undefined && chosenIdx !== undefined) {
        result[fieldKey] = chosenAmount;
        usedLineIndices.add(chosenIdx);
        break;
      }
    }
  }

  // ---- Pass 2b: table with header row (exact column mapping) ----
  // Format: one line = numbers, adjacent line = tab/space-separated labels (e.g. "שכר בסיס\t...\tסכום בבנק")
  const TABLE_MIN_COLS = 6;
  for (let i = 0; i < lines.length; i++) {
    const dataLine = lines[i];
    const amounts = extractOrderedAmountsFromLine(dataLine);
    if (amounts.length < TABLE_MIN_COLS) continue;
    const hasSalaryRange = amounts.some(a => a >= 1000 && a <= 100000);
    if (!hasSalaryRange) continue;

    for (const delta of [1, -1]) {
      const j = i + delta;
      if (j < 0 || j >= lines.length) continue;
      const headerCells = splitHeaderCells(lines[j]);
      if (headerCells.length < TABLE_MIN_COLS || headerCells.length !== amounts.length) continue;

      let matchCount = 0;
      for (const fieldKey of FIELD_ORDER) {
        if (result[fieldKey] !== undefined) continue;
        const patterns = PAYSLIP_LABEL_MAP[fieldKey];
        if (!patterns) continue;
        let colIndex = -1;
        for (let c = 0; c < headerCells.length; c++) {
          const cellNorm = normalizeLine(headerCells[c]);
          if (!cellNorm) continue;
          if (lineMatchesExclude(cellNorm, fieldKey)) continue;
          if (patterns.some(p => lineMatchesPattern(cellNorm, p))) {
            colIndex = c;
            break;
          }
        }
        if (colIndex < 0 || colIndex >= amounts.length) continue;
        const value = amounts[colIndex];
        if (fieldKey === 'net_payable' && value >= 1000 && value <= 100000) {
          result[fieldKey] = value;
          matchCount++;
        } else if (fieldKey === 'gross_total' || fieldKey === 'base_salary') {
          if (value >= 500 && value <= 200000) {
            result[fieldKey] = value;
            matchCount++;
          }
        } else if (fieldKey === 'travel_expenses') {
          if (value >= 0 && value <= 5000) {
            result[fieldKey] = value;
            matchCount++;
          }
        } else if (['income_tax', 'national_insurance', 'health_insurance', 'mandatory_total'].includes(fieldKey)) {
          if (value >= 0 && value <= DEDUCTION_MAX && isReasonableDeduction(fieldKey, value)) {
            result[fieldKey] = value;
            matchCount++;
          }
        } else if (fieldKey === 'global_overtime') {
          if (value >= 0 && value <= 50000) {
            result[fieldKey] = value;
            matchCount++;
          }
        }
      }
      if (matchCount >= 2) break;
    }
  }

  // ---- Pass 3: table row (multiple amounts; header can be previous OR next line) ----
  for (let i = 0; i < lines.length; i++) {
    const dataLine = lines[i];
    const amounts = extractAllAmountsFromLine(dataLine, { min: 1, max: 500000 });
    if (amounts.length < 3) continue;

    const inSalaryRange = amounts.filter(a => a >= 2000 && a <= 100000).sort((a, b) => b - a);
    const inDeductionRange = amounts.filter(a => a >= 100 && a <= 5000);
    const prevNorm = i > 0 ? normalizeLine(lines[i - 1]) : '';
    const nextNorm = i + 1 < lines.length ? normalizeLine(lines[i + 1]) : '';
    const lineMatchesFieldNearby = fieldKey => {
      const patterns = PAYSLIP_LABEL_MAP[fieldKey] || [];
      const prevMatches = prevNorm
        && !lineMatchesExclude(prevNorm, fieldKey)
        && patterns.some(p => lineMatchesPattern(prevNorm, p));
      const nextMatches = nextNorm
        && !lineMatchesExclude(nextNorm, fieldKey)
        && patterns.some(p => lineMatchesPattern(nextNorm, p));
      return prevMatches || nextMatches;
    };
    const hasGrossLabel = lineMatchesFieldNearby('gross_total');
    const hasBaseLabel = lineMatchesFieldNearby('base_salary');
    const hasMandatoryLabel = lineMatchesFieldNearby('mandatory_total');

    // Only take gross/base from rows that look like the main table (≥2 salary-range amounts)
    const isLikelyMainTable = inSalaryRange.length >= 2;

    if (result.gross_total === undefined && hasGrossLabel && inSalaryRange.length) {
      result.gross_total = inSalaryRange[0];
    } else if (
      isLikelyMainTable &&
      hasGrossLabel &&
      inSalaryRange[0] > (result.gross_total ?? 0)
    ) {
      result.gross_total = inSalaryRange[0];
    }
    if (result.base_salary === undefined && hasBaseLabel && inSalaryRange.length) {
      result.base_salary = inSalaryRange[inSalaryRange.length > 1 ? 1 : 0];
    } else if (
      isLikelyMainTable &&
      hasBaseLabel &&
      inSalaryRange.length >= 2 &&
      (result.base_salary === undefined || result.base_salary < 1000)
    ) {
      result.base_salary = inSalaryRange[1];
    }
    const deductionCapped = inDeductionRange.filter(a => a <= DEDUCTION_MAX);
    if (result.mandatory_total === undefined && hasMandatoryLabel && deductionCapped.length) {
      result.mandatory_total = Math.max(...deductionCapped);
    }
  }

  return result;
}

/**
 * Add label variants for a field. Use at startup or in tests to extend the map
 * without editing this file (e.g. from config or user feedback).
 *
 * @param {string} fieldKey - Key from PAYSLIP_LABEL_MAP
 * @param {string|RegExp|(string|RegExp)[]} patterns - One or more patterns to append
 */
function addLabelPatterns(fieldKey, patterns) {
  if (!PAYSLIP_LABEL_MAP[fieldKey]) {
    PAYSLIP_LABEL_MAP[fieldKey] = [];
    FIELD_ORDER.push(fieldKey);
  }
  const arr = Array.isArray(patterns) ? patterns : [patterns];
  PAYSLIP_LABEL_MAP[fieldKey].push(...arr);
}

module.exports = {
  PAYSLIP_LABEL_MAP,
  FIELD_ORDER,
  extractFromLinesByLabelMap,
  addLabelPatterns,
  normalizeLine,
  extractAmountFromLine,
  extractAllAmountsFromLine,
  extractOrderedAmountsFromLine,
  splitHeaderCells,
  lineMatchesPattern,
  lineMatchesExclude,
};
