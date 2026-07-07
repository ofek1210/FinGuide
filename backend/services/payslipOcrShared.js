const path = require('path');

const { parseOcrNumber } = require('./payslipOcrNumbers');

const HEBREW_MONTHS = {
  ינואר: '01',
  פברואר: '02',
  מרץ: '03',
  מרס: '03',
  אפריל: '04',
  מאי: '05',
  יוני: '06',
  יולי: '07',
  אוגוסט: '08',
  ספטמבר: '09',
  אוקטובר: '10',
  נובמבר: '11',
  דצמבר: '12',
};

const HMO_MAP = {
  מכבי: 'Maccabi',
  כללית: 'Clalit',
  מאוחדת: 'Meuhedet',
  לאומית: 'Leumit',
};

const MONTH_NAME_HEADER_REGEX =
  /^(דצמבר|ינואר|פברואר|מרץ|מרס|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר)$/;
// Hebrew בע"מ variants (בע'מ, בע'ימ, בעיימ, בע''מ) — no \b because Hebrew chars are \W in JS regex
const COMPANY_HINT_REGEX = /(?:בע["']{0,2}[י]{0,2}מ|Ltd|Inc|LLC|Corp|Company|Technologies|Solutions)/i;
const EMPLOYER_CONTEXT_REGEX = /(?:שם\s+מעסיק|שם\s+מעביד|מעסיק|מעביד|Employer|Company|חברה)/i;

/**
 * Single normalization for Hebrew payslip lines (used by the label map, the
 * IDF profile and the contributions extractor — keep only this copy):
 * - underscores → spaces (IDF payslips use underscores instead of spaces)
 * - "סה כ" → "סהכ", "נכוי ל" → "ניכוי ל" (common OCR splits/typos)
 * - collapse whitespace, unify quote characters
 */
function normalizeHebrewLine(raw) {
  if (!raw || typeof raw !== 'string') return '';
  return raw
    .replace(/_/g, ' ')
    .replace(/סה\s+כ/g, 'סהכ')
    .replace(/נכוי(\s+ל)/g, 'ניכוי$1')
    .replace(/\s+/g, ' ')
    .replace(/[’'`׳]/g, "'")
    .replace(/[“”״]/g, '"')
    .trim();
}

function parseMoney(value) {
  return parseOcrNumber(value);
}

function parsePercent(value) {
  if (!value) return undefined;
  return parseOcrNumber(String(value).replace('%', '').trim());
}

function parseNumber(value) {
  return parseOcrNumber(value);
}

function linesOf(text) {
  return String(text)
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
}

function match1(text, regex) {
  const match = String(text).match(regex);
  return match?.[1]?.trim();
}

function matchAmountFlexible(text, regex, parser = parseMoney) {
  const value = match1(text, regex);
  return parser(value);
}

function extractMonthFromFilename(filePath) {
  const base = path.basename(filePath);
  const match = base.match(/(20\d{2})[-_.](\d{2})/);
  if (!match) return undefined;
  return `${match[1]}-${match[2]}`;
}

function extractMonthYYYYMM(text) {
  const value = String(text);

  const hebrewMonth = value.match(
    /(ינואר|פברואר|מרץ|מרס|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר)\s*(20\d{2})/,
  );
  if (hebrewMonth) {
    const mm = HEBREW_MONTHS[hebrewMonth[1]];
    if (mm) return `${hebrewMonth[2]}-${mm}`;
  }

  const monthSlashYear = value.match(/(\d{2})\/(20\d{2})/);
  if (monthSlashYear) return `${monthSlashYear[2]}-${monthSlashYear[1]}`;

  const lekhodesh = value.match(/לחודש\s+(\d{1,2})\/(20\d{2})/i);
  if (lekhodesh) {
    return `${lekhodesh[2]}-${String(lekhodesh[1]).padStart(2, '0')}`;
  }

  const dateRange = value.match(/מ-\d{2}\/(\d{2})\/(\d{2})\s+עד\s+\d{2}\/\1\/\2/);
  if (dateRange) return `20${dateRange[2]}-${dateRange[1]}`;

  return undefined;
}

function parseDateDDMMYYYYorYY(value) {
  if (!value) return undefined;
  const match = String(value).match(/(\d{2})\/(\d{2})\/(\d{2}|\d{4})/);
  if (!match) return undefined;
  const dd = match[1];
  const mm = match[2];
  let yy = match[3];
  if (yy.length === 2) yy = `20${yy}`;
  return `${yy}-${mm}-${dd}`;
}

function extractHMO(text) {
  const match = String(text).match(/קופת[-\s]?חולים\s+([^\s]+)/i);
  return match?.[1];
}

function translateHMO(hmo) {
  if (!hmo) return undefined;
  return HMO_MAP[hmo] || hmo;
}

/**
 * Detect payslip text whose Hebrew came out garbled (mojibake / bad font
 * decoding). Such text has unusable labels — numeric-layout rescue or OCR
 * should be used instead of label matching.
 */
function isLikelyBrokenHebrew(text) {
  if (!text) return false;
  const value = String(text);
  const hebrewCount = (value.match(/[\u0590-\u05FF]/g) || []).length;
  const weirdLatinCount = (value.match(/[À-ÿ]/g) || []).length;
  const modifierLetterCount = (value.match(/[\u02B0-\u02FF]/g) || []).length;
  const replacementCount = (value.match(/\uFFFD/g) || []).length;

  // Mojibake: PDF fonts decoded as replacement chars — labels unusable, prefer OCR/rescue
  if (replacementCount > 15) return true;
  // Long payslip text with almost no Hebrew is almost certainly broken encoding
  if (value.length > 400 && hebrewCount < 8) return true;
  if (hebrewCount < 5 && modifierLetterCount > 30) return true;
  return hebrewCount < 5 && weirdLatinCount > 20;
}

function isLikelyTaxBaseNoiseLine(line) {
  return /(שכר\s*חייב|הכנסה\s*חייבת|ברוטו\s*למס|לב\.?\s*לאומי|ב\.?\s*ל\.?|מס\s*מצטבר)/i.test(line);
}

function isCumulativeLine(line) {
  return /(?:מצטבר|מצטברת|מצטברים|מצטברות|cumulative|נתונים\s*מצטברים)/i.test(String(line));
}

/**
 * Detect lines that appear in the Michpal "נתונים מצטברים" right-column zone.
 * These lines look like monthly deduction lines but contain year-to-date totals:
 * "שכר חייב מס36747.67", "בט. לאומי158.00", "מס בריאות1143.00", "פנסיה1139.52"
 * They appear AFTER the "נתונים נוספיםנתונים מצטברים" combined header.
 */
function isLikelyCumulativeZoneLine(line) {
  const s = String(line);
  // These specific labels followed by large amounts indicate cumulative data
  if (/(?:שכ\.\s*ב\.\s*לאומי|שכר\s*חייב\s*מס)/i.test(s)) return true;
  // "גמל מעסיק", "ב.לאומי מעסיק", "לפיצ." are employer-side cumulative
  if (/(?:גמל\s*מעסיק|ב\.\s*לאומי\s*מעסיק|לפיצ\.)/i.test(s)) return true;
  return false;
}

function categorizeOcrWarning(warning) {
  const value = String(warning || '').trim();
  if (!value) return 'other';

  if (/Missing period\.month/i.test(value)) return 'missing.period_month';
  if (/Missing salary\.gross_total/i.test(value)) return 'missing.salary.gross_total';
  if (/Missing salary\.net_payable/i.test(value)) return 'missing.salary.net_payable';
  if (/Missing deductions\.mandatory\.total/i.test(value)) return 'missing.deductions.mandatory.total';
  if (/Study fund line not found/i.test(value)) return 'missing.contributions.study_line';
  if (/Pension lines not found/i.test(value)) return 'missing.contributions.pension_line';
  if (/Study fund amounts found but employee\/employer roles were ambiguous/i.test(value)) {
    return 'ambiguous.contributions.study_roles';
  }
  if (/Pension contribution lines found but employee\/employer roles were ambiguous/i.test(value)) {
    return 'ambiguous.contributions.pension_roles';
  }
  if (/Unrealistic contribution amount/i.test(value)) return 'invalid.contributions.amount';
  if (/Conflicting gross\/net candidates/i.test(value)) return 'conflict.salary.gross_net';
  if (/Mandatory deductions total conflicts/i.test(value)) {
    return 'conflict.deductions.mandatory_total';
  }

  return 'other';
}

function pickReasonableAmount(nums, { min = 50, max = 50000 } = {}) {
  const filtered = nums.filter(value => value >= min && value <= max);
  if (!filtered.length) return undefined;
  return filtered.sort((a, b) => b - a)[0];
}

function bestAmountByExpected(amounts, expected, tolerance = 15) {
  let best;
  let bestDiff = Infinity;

  for (const value of amounts) {
    const diff = Math.abs(value - expected);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = value;
    }
  }

  if (best === undefined) return undefined;
  return bestDiff <= tolerance ? best : undefined;
}

function clampScore(score) {
  return Math.max(0, Math.min(1, score));
}

function dedupeStrings(values) {
  return [...new Set(values.filter(Boolean))];
}

const PAYSLIP_PERIOD_LINE_REGEX =
  /(?:לחודש|חודש|תקופה|תלוש\s+שכר|שנת)\s*[^\n]{0,24}\d{1,2}\s*\/\s*20\d{2}|\d{1,2}\s*\/\s*20\d{2}/i;

function isPayslipPeriodNoise(value, lineText) {
  if (!Number.isFinite(value) || !lineText) {
    return false;
  }

  const text = String(lineText);
  if (!PAYSLIP_PERIOD_LINE_REGEX.test(text)) {
    return false;
  }

  if (value >= 2000 && value <= 2099) {
    return true;
  }

  if (value >= 1 && value <= 12) {
    return true;
  }

  return false;
}

module.exports = {
  COMPANY_HINT_REGEX,
  EMPLOYER_CONTEXT_REGEX,
  MONTH_NAME_HEADER_REGEX,
  bestAmountByExpected,
  clampScore,
  categorizeOcrWarning,
  dedupeStrings,
  extractHMO,
  extractMonthFromFilename,
  extractMonthYYYYMM,
  isCumulativeLine,
  isLikelyBrokenHebrew,
  isLikelyCumulativeZoneLine,
  isLikelyTaxBaseNoiseLine,
  isPayslipPeriodNoise,
  linesOf,
  match1,
  normalizeHebrewLine,
  matchAmountFlexible,
  parseDateDDMMYYYYorYY,
  parseMoney,
  parseNumber,
  parsePercent,
  pickReasonableAmount,
  translateHMO,
};
