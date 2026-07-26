'use strict';

const XLSX = require('xlsx');
const { emptyNormalizedAccount } = require('./schemas');
const { resolveFundType, parseProductType } = require('../harHaKesefService');

const COLUMN_ALIASES = {
  accountNumber: ['מספר חשבון', 'account', 'account number', 'מס\' חשבון'],
  fundName: ['שם קרן', 'שם מוצר', 'fund name', 'product name', 'קרן'],
  companyName: ['חברה', 'גוף מנהל', 'company', 'provider', 'מנהל'],
  productType: ['סוג', 'סוג מוצר', 'product type', 'סוג קופה'],
  trackName: ['מסלול', 'מסלול השקעה', 'track', 'investment track'],
  fundCode: ['קוד קרן', 'fund code', 'fund id', 'מספר קרן'],
  balance: ['יתרה', 'צבירה', 'balance', 'current balance', 'סך צבירה'],
  employeeDeposit: ['הפקדת עובד', 'employee', 'employee deposit'],
  employerDeposit: ['הפקדת מעסיק', 'employer', 'employer deposit'],
  monthlyDeposit: ['הפקדה חודשית', 'monthly deposit', 'סך הפקדה'],
  mgmtFeeBalance: ['דמי ניהול מצבירה', 'management fee balance', 'ד"נ מצבירה', 'דמי ניהול מהצבירה'],
  mgmtFeeDeposit: ['דמי ניהול מהפקדה', 'management fee deposit', 'ד"נ מהפקדה'],
  status: ['סטטוס', 'status', 'מצב'],
  liquidityDate: ['תאריך נזילות', 'liquidity date', 'נזילות'],
  openingDate: ['תאריך פתיחה', 'opening date'],
};

function normalizeHeader(cell) {
  return String(cell || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function parsePercentOrNumber(val) {
  if (val == null || val === '' || val === '-') return null;
  const s = String(val).replace(/[,₪%\s]/g, '').trim();
  const n = parseFloat(s);
  if (!Number.isFinite(n)) return null;
  return n;
}

function parseBalance(val) {
  return parsePercentOrNumber(val);
}

function parseFeePct(val) {
  const n = parsePercentOrNumber(val);
  if (n == null) return null;
  return n;
}

function findHeaderRow(rows) {
  for (let i = 0; i < Math.min(rows.length, 30); i += 1) {
    const row = rows[i] || [];
    const joined = row.map(normalizeHeader).join(' ');
    const hits = ['יתרה', 'צבירה', 'balance', 'שם קרן', 'fund name', 'חברה', 'company'].filter(k => joined.includes(k));
    if (hits.length >= 2) return i;
  }
  return -1;
}

function mapColumnIndices(headers) {
  const normalized = headers.map(normalizeHeader);
  const idx = {};
  for (const [key, aliases] of Object.entries(COLUMN_ALIASES)) {
    idx[key] = normalized.findIndex(h => aliases.some(a => h.includes(normalizeHeader(a))));
  }
  return idx;
}

function mapProductType(fundType) {
  if (fundType === 'study_fund') return 'study_fund';
  if (fundType === 'provident_fund') return 'gemel';
  if (/השתלמות/i.test(fundType)) return 'study_fund';
  if (/גמל|תגמול/i.test(fundType)) return 'gemel';
  if (/השקעה/i.test(fundType)) return 'investment_gemel';
  if (/ילד/i.test(fundType)) return 'child_savings';
  return 'unknown';
}

function parseAccountRow(row, colIdx, { userId, sheetName, rowIndex }) {
  const warnings = [];
  const fundName = colIdx.fundName >= 0 ? String(row[colIdx.fundName] ?? '').trim() : '';
  const companyName = colIdx.companyName >= 0 ? String(row[colIdx.companyName] ?? '').trim() : null;
  const productRaw = colIdx.productType >= 0 ? String(row[colIdx.productType] ?? '').trim() : '';
  const parsedProduct = parseProductType(productRaw);
  const resolvedType = resolveFundType(parsedProduct.cleanType || productRaw || fundName);

  if (!['study_fund', 'provident_fund'].includes(resolvedType)) {
    return null;
  }

  const balance = colIdx.balance >= 0 ? parseBalance(row[colIdx.balance]) : null;
  if (balance == null) warnings.push('חסרה יתרה');

  const employeeDeposit = colIdx.employeeDeposit >= 0 ? parseBalance(row[colIdx.employeeDeposit]) : 0;
  const employerDeposit = colIdx.employerDeposit >= 0 ? parseBalance(row[colIdx.employerDeposit]) : 0;
  let monthlyDeposit = colIdx.monthlyDeposit >= 0 ? parseBalance(row[colIdx.monthlyDeposit]) : null;
  if (monthlyDeposit == null) monthlyDeposit = (employeeDeposit || 0) + (employerDeposit || 0);

  const statusRaw = colIdx.status >= 0 ? String(row[colIdx.status] ?? '').trim() : '';
  const inactive = parsedProduct.status === 'INACTIVE' || /לא פעיל|סגור|inactive/i.test(statusRaw);

  return emptyNormalizedAccount({
    accountId: colIdx.accountNumber >= 0 ? String(row[colIdx.accountNumber] ?? '').trim() || `row-${rowIndex}` : `row-${rowIndex}`,
    userId: String(userId),
    productType: mapProductType(resolvedType),
    fundCode: colIdx.fundCode >= 0 ? String(row[colIdx.fundCode] ?? '').trim() || null : null,
    fundName: fundName || `${companyName || 'קופה'} — ${parsedProduct.cleanType || productRaw}`,
    companyName,
    trackName: colIdx.trackName >= 0 ? String(row[colIdx.trackName] ?? '').trim() || null : null,
    accountStatus: inactive ? 'inactive' : 'active',
    balance: balance || 0,
    monthlyDeposit: monthlyDeposit || 0,
    employeeDeposit: employeeDeposit || 0,
    employerDeposit: employerDeposit || 0,
    managementFeeDepositPct: colIdx.mgmtFeeDeposit >= 0 ? parseFeePct(row[colIdx.mgmtFeeDeposit]) : null,
    managementFeeBalancePct: colIdx.mgmtFeeBalance >= 0 ? parseFeePct(row[colIdx.mgmtFeeBalance]) : null,
    liquidityDate: colIdx.liquidityDate >= 0 ? String(row[colIdx.liquidityDate] ?? '').trim() || null : null,
    openingDate: colIdx.openingDate >= 0 ? String(row[colIdx.openingDate] ?? '').trim() || null : null,
    source: 'user_excel',
    rawData: { sheetName, rowIndex, productRaw },
    warnings,
  });
}

function detectRelevantSheet(workbook) {
  const names = workbook.SheetNames || [];
  const preferred = names.find(n => /גמל|השתלמות|מסלק|har|דוח/i.test(n));
  return preferred || names[0];
}

function parseUserExcelBuffer(buffer, userId, { sheetName = null } = {}) {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const targetSheet = sheetName || detectRelevantSheet(workbook);
  const ws = workbook.Sheets[targetSheet];
  if (!ws) {
    return { accounts: [], warnings: ['לא נמצא גיליון רלוונטי'], sheetName: null };
  }

  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false });
  const headerRowIdx = findHeaderRow(rows);
  if (headerRowIdx < 0) {
    return { accounts: [], warnings: ['לא זוהתה שורת כותרות'], sheetName: targetSheet };
  }

  const colIdx = mapColumnIndices(rows[headerRowIdx]);
  const accounts = [];
  const globalWarnings = [];

  for (let i = headerRowIdx + 1; i < rows.length; i += 1) {
    const row = rows[i];
    if (!row || row.every(c => c == null || String(c).trim() === '')) continue;
    const account = parseAccountRow(row, colIdx, { userId, sheetName: targetSheet, rowIndex: i });
    if (account) accounts.push(account);
  }

  if (!accounts.length) globalWarnings.push('לא נמצאו חשבונות גמל/השתלמות בקובץ');

  return { accounts, warnings: globalWarnings, sheetName: targetSheet, rowCount: rows.length };
}

module.exports = {
  parseUserExcelBuffer,
  findHeaderRow,
  mapColumnIndices,
  COLUMN_ALIASES,
};
