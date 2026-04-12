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
const COMPANY_HINT_REGEX = /\b(?:בע["']?מ|Ltd|Inc|LLC|Corp|Company|Technologies|Solutions)\b/i;
const EMPLOYER_CONTEXT_REGEX = /(?:שם\s+מעסיק|שם\s+מעביד|מעסיק|מעביד|Employer|Company|חברה)/i;

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

function isLikelyTaxBaseNoiseLine(line) {
  return /(שכר\s*חייב|הכנסה\s*חייבת|ברוטו\s*למס|לב\.?\s*לאומי|ב\.?\s*ל\.?|מס\s*מצטבר)/i.test(line);
}

function isCumulativeLine(line) {
  return /(?:מצטבר|מצטברת|cumulative)/i.test(String(line));
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

module.exports = {
  COMPANY_HINT_REGEX,
  EMPLOYER_CONTEXT_REGEX,
  MONTH_NAME_HEADER_REGEX,
  bestAmountByExpected,
  clampScore,
  dedupeStrings,
  extractHMO,
  extractMonthFromFilename,
  extractMonthYYYYMM,
  isCumulativeLine,
  isLikelyTaxBaseNoiseLine,
  linesOf,
  match1,
  matchAmountFlexible,
  parseDateDDMMYYYYorYY,
  parseMoney,
  parseNumber,
  parsePercent,
  pickReasonableAmount,
  translateHMO,
};
