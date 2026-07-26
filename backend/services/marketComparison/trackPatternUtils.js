'use strict';

/**
 * Shared Hebrew track text helpers for risk and comparison-group classification.
 * Returns are intentionally excluded from every helper in this module.
 *
 * Note: JavaScript \b word boundaries are ASCII-only and are not used for Hebrew tokens.
 */

function normalizeText(...parts) {
  return parts
    .filter((part) => part != null && part !== '')
    .map((part) => String(part).trim().toLowerCase())
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function includesAny(text, patterns) {
  return patterns.some((pattern) => pattern.test(text));
}

const AGE_UNDER_50_PATTERNS = [
  /עד\s*50/,
  /50\s*ומטה/,
  /גיל(?:אי)?\s*50\s*ומטה/,
  /לבני\s*50\s*ומטה/,
];

const AGE_50_60_PATTERNS = [
  /50\s*[-–]\s*60/,
  /50\s*עד\s*60/,
  /גיל(?:אי)?\s*50\s*עד\s*60/,
  /לבני\s*50\s*עד\s*60/,
];

const AGE_OVER_60_PATTERNS = [
  /60\s*ומעלה/,
  /מעל\s*60/,
  /גיל(?:אי)?\s*60/,
  /לבני\s*60/,
];

const SP500_PATTERNS = [
  /s\s*&\s*p\s*500/,
  /sp\s*500/,
  /עוק(?:ב|בי)\s+מד(?:d)?(?:ei)?\s+s\s*&\s*p\s*500/,
];

const EQUITY_NAME_PATTERNS = [
  /מניות/,
  /מניית/,
  /עוק(?:ב|בי)\s+מד(?:d)?(?:ei)?\s+מניות/,
  /100%\s*מניות/,
];

const BOND_NAME_PATTERNS = [
  /אג["״']?ח/,
  /אשרא/,
  /מד(?:d)?(?:ei)?\s+אג["״']?ח/,
];

const GENERAL_NAME_PATTERNS = [/כללי/, /משולב/];

const HALACHA_PATTERNS = [/הלכ(?:ה|תי)/];

const CASH_PATTERNS = [/שיקלי/, /כספי/, /כספית/, /כסף/];

const ANNUITY_PATTERNS = [/מקבלי\s+קצבה/, /בסיסי\s+למקבלי\s+קצבה/, /קצבה/];

function detectAgeBucket(text) {
  if (includesAny(text, AGE_OVER_60_PATTERNS)) return 'over_60';
  if (includesAny(text, AGE_50_60_PATTERNS)) return '50_60';
  if (includesAny(text, AGE_UNDER_50_PATTERNS)) return 'under_50';
  return null;
}

function detectSp500(text) {
  return includesAny(text, SP500_PATTERNS);
}

function detectEquityName(text) {
  return includesAny(text, EQUITY_NAME_PATTERNS);
}

function detectBondName(text) {
  return includesAny(text, BOND_NAME_PATTERNS);
}

function detectGeneralName(text) {
  return includesAny(text, GENERAL_NAME_PATTERNS);
}

function detectHalacha(text) {
  return includesAny(text, HALACHA_PATTERNS);
}

function detectCash(text) {
  return includesAny(text, CASH_PATTERNS);
}

function detectAnnuity(text) {
  return includesAny(text, ANNUITY_PATTERNS);
}

function stockExposureRiskLevel(stockExposurePct) {
  if (stockExposurePct == null || Number.isNaN(stockExposurePct)) return null;
  if (stockExposurePct >= 55) return 'high';
  if (stockExposurePct <= 25) return 'low';
  return 'medium';
}

function ageBucketRiskLevel(ageBucket) {
  if (ageBucket === 'under_50') return 'high';
  if (ageBucket === '50_60') return 'medium';
  if (ageBucket === 'over_60') return 'low';
  return null;
}

module.exports = {
  normalizeText,
  detectAgeBucket,
  detectSp500,
  detectEquityName,
  detectBondName,
  detectGeneralName,
  detectHalacha,
  detectCash,
  detectAnnuity,
  stockExposureRiskLevel,
  ageBucketRiskLevel,
};
