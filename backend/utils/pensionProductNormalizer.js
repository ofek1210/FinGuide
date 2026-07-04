'use strict';

/**
 * Normalize clearinghouse / CSV product rows for pension-only comparison.
 * Accepts Hebrew column names from "פרטי המוצרים שלי" or English DTO keys.
 */

const FIELD_ALIASES = {
  companyName: ['companyName', 'שם חברה מנהלת', 'חברה מנהלת', 'גוף מנהל', 'provider'],
  productName: ['productName', 'שם מוצר', 'שם המוצר', 'fundName'],
  productType: ['productType', 'סוג מוצר', 'סוג קופה', 'fundType'],
  totalSavings: ['totalSavings', 'סך הכל חיסכון', 'יתרה', 'צבירה', 'currentBalance'],
  depositFee: ['depositFee', 'שיעור דמי ניהול מהפקדות', 'דמי ניהול מהפקדות', 'managementFeeDeposit'],
  assetFee: ['assetFee', 'שיעור דמי ניהול שנתי מחיסכון צבור', 'דמי ניהול מצבירה', 'managementFeeAccumulation'],
  status: ['status', 'סטטוס', 'מצב', 'activityStatus'],
  isActive: ['isActive'],
};

function pickField(row, aliases) {
  for (const key of aliases) {
    if (row[key] != null && row[key] !== '') return row[key];
  }
  return null;
}

function parseNum(val) {
  if (val == null || val === '' || val === '-') return null;
  const n = parseFloat(String(val).replace(/[,₪%\s]/g, ''));
  return Number.isFinite(n) ? n : null;
}

/** Percent fee: CSV uses 0.9 (=0.9%). Values <= 0.05 treated as decimal fractions. */
function normalizeFeePercent(val) {
  const n = parseNum(val);
  if (n == null) return null;
  return Math.abs(n) <= 0.05 ? n * 100 : n;
}

function isPensionProduct(productType, productName) {
  const ctx = `${productType || ''} ${productName || ''}`;
  if (!/פנסיה|pension/i.test(ctx)) return false;
  if (/שתלמות|study.?fund|קופת גמל|גמל להשקעה|ביטוח מנהלים|provident/i.test(ctx)
    && !/פנסיה|pension/i.test(ctx)) {
    return false;
  }
  return true;
}

function isActiveProduct(statusRaw, isActiveFlag) {
  if (isActiveFlag === false) return false;
  const s = String(statusRaw || '').trim();
  if (/לא פעיל|שבוטל|סגור|inactive|closed/i.test(s)) return false;
  if (/פעיל|active/i.test(s)) return true;
  return isActiveFlag !== false;
}

/**
 * @param {object} row — Hebrew clearinghouse row, English DTO, or mixed
 * @returns {object|null}
 */
function normalizeProductRow(row) {
  if (!row || typeof row !== 'object') return null;

  const productType = String(pickField(row, FIELD_ALIASES.productType) || '').trim();
  const productName = String(pickField(row, FIELD_ALIASES.productName) || '').trim();
  const companyName = String(pickField(row, FIELD_ALIASES.companyName) || '').trim();
  const status = String(pickField(row, FIELD_ALIASES.status) || '').trim();
  const isActiveRaw = pickField(row, FIELD_ALIASES.isActive);

  // Clearinghouse exports often leave "סוג מוצר" empty — product label is in "שם מוצר"
  const effectiveProductType = productType || productName;

  return {
    companyName,
    productName,
    productType: effectiveProductType,
    totalSavings: parseNum(pickField(row, FIELD_ALIASES.totalSavings)) ?? 0,
    depositFee: normalizeFeePercent(pickField(row, FIELD_ALIASES.depositFee)),
    assetFee: normalizeFeePercent(pickField(row, FIELD_ALIASES.assetFee)),
    status,
    isActive: isActiveProduct(status, isActiveRaw),
  };
}

/** Map stored PensionFund → clearinghouse-style row for business rules */
function fundDocumentToProductRow(fund) {
  if (!fund) return null;
  if (fund.rawData && typeof fund.rawData === 'object') {
    const fromRaw = normalizeProductRow(fund.rawData);
    if (fromRaw?.productType || fromRaw?.productName) return fromRaw;
  }

  const typeByFundType = {
    pension_comprehensive: 'פנסיה חדשה מקיפה',
    pension_old: 'פנסיה ותיקה',
    provident_fund: 'קופת גמל',
    study_fund: 'קרן השתלמות',
    managers_insurance: 'ביטוח מנהלים',
  };

  const inactive = fund.activityStatus === 'INACTIVE' || fund.status === 'closed' || fund.isActive === false;

  return normalizeProductRow({
    'שם מוצר': fund.fundName,
    'סוג מוצר': typeByFundType[fund.fundType] || fund.fundName,
    'שם חברה מנהלת': fund.provider,
    'סטטוס': inactive ? 'לא פעיל' : 'פעיל',
    'סך הכל חיסכון': fund.currentBalance,
    'שיעור דמי ניהול מהפקדות': fund.managementFeeDeposit != null
      ? fund.managementFeeDeposit * 100
      : null,
    'שיעור דמי ניהול שנתי מחיסכון צבור': fund.managementFeeAccumulation != null
      ? fund.managementFeeAccumulation * 100
      : null,
    isActive: !inactive,
  });
}

/**
 * @param {object[]} rows — raw product rows
 * @returns {object[]}
 */
function filterPensionProducts(rows) {
  if (!Array.isArray(rows)) return [];

  return rows
    .map(row => {
      const normalized = normalizeProductRow(row);
      if (!normalized) return null;
      if (!isPensionProduct(normalized.productType, normalized.productName)) return null;
      if (!normalized.isActive) return null;
      return normalized;
    })
    .filter(Boolean);
}

module.exports = {
  filterPensionProducts,
  normalizeProductRow,
  fundDocumentToProductRow,
  normalizeFeePercent,
  isPensionProduct,
  isActiveProduct,
  parseNum,
  pickField,
  FIELD_ALIASES,
};
