

/**
 * Parser for official Pension Clearinghouse (מסלקה פנסיונית) Excel exports.
 * Reads 3 sheets: products, deposit history, insurance coverages.
 */
const XLSX = require('xlsx');
const { resolveFundType, parseProductType } = require('./harHaKesefService');

const SHEET_PRODUCTS = ['פרטי המוצרים שלי', 'פרטי מוצרים'];
const SHEET_DEPOSITS = ['מעקב הפקדות', 'הפקדות'];
const SHEET_INSURANCE = ['כיסויים ביטוחיים', 'כיסויים'];

function normCell(val) {
  return String(val ?? '')
    .replace(/\uFEFF/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function safeNum(val) {
  if (val == null || val === '' || val === '-') return null;
  const n = parseFloat(String(val).replace(/[,₪%\s]/g, ''));
  return Number.isFinite(n) ? n : null;
}

/** דמי ניהול בדוח המסלקה — אחוזים (0.15 = 0.15%) → שבר */
function normalizeFeePercent(val) {
  const n = safeNum(val);
  if (n == null) return null;
  return n / 100;
}

function normalizePercent(val) {
  const n = safeNum(val);
  if (n == null) return null;
  return Math.abs(n) > 1 ? n : n * 100;
}

function mapActivityStatus(raw) {
  const s = normCell(raw);
  if (!s) return 'UNKNOWN';
  if (/לא פעיל|שבוטל|סגור|inactive|closed/i.test(s)) return 'INACTIVE';
  if (/פעיל|active/i.test(s)) return 'ACTIVE';
  return 'UNKNOWN';
}

function toFundLifecycle(activityStatus) {
  const active = activityStatus !== 'INACTIVE';
  return {
    activityStatus,
    status: active ? 'active' : 'closed',
    isActive: active,
  };
}

function findSheet(workbook, candidates) {
  const names = workbook.SheetNames || [];
  for (const cand of candidates) {
    const hit = names.find(n => normCell(n).includes(cand));
    if (hit) return hit;
  }
  return null;
}

function sheetToRows(workbook, sheetName) {
  if (!sheetName) return [];
  const ws = workbook.Sheets[sheetName];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
}

function findHeaderRow(rows, keywords) {
  for (let i = 0; i < Math.min(rows.length, 25); i++) {
    const row = rows[i];
    if (!row) continue;
    const joined = row.map(normCell).join(' ');
    if (keywords.some(kw => joined.includes(kw))) return i;
  }
  return -1;
}

function findCol(headers, ...candidates) {
  for (const candidate of candidates) {
    const idx = headers.findIndex(h => h && normCell(h).includes(candidate));
    if (idx >= 0) return idx;
  }
  return -1;
}

function parseProductsSheet(rows, warnings) {
  const headerIdx = findHeaderRow(rows, ['שם מוצר', 'סוג מוצר', 'חברה מנהלת', 'מספר פוליסה', 'סך הכל חיסכון']);
  if (headerIdx === -1) {
    warnings.push('לא נמצאה שורת כותרות בגיליון "פרטי המוצרים שלי"');
    return [];
  }

  const headers = rows[headerIdx].map(h => normCell(h));
  const col = {
    productName: findCol(headers, 'שם מוצר', 'שם המוצר'),
    productType: findCol(headers, 'סוג מוצר', 'סוג קופה', 'סוג'),
    provider: findCol(headers, 'שם חברה מנהלת', 'חברה מנהלת', 'גוף מנהל'),
    accountNumber: findCol(headers, 'מספר פוליסה', 'מספר חשבון', 'חשבון'),
    status: findCol(headers, 'סטטוס', 'מצב'),
    balance: findCol(headers, 'סך הכל חיסכון', 'יתרה', 'צבירה', 'סך חיסכון'),
    feeDeposit: findCol(headers, 'דמי ניהול מהפקדות', 'שיעור דמי ניהול מהפקדות', 'מהפקדה'),
    feeAccum: findCol(headers, 'דמי ניהול שנתי', 'שיעור דמי ניהול שנתי', 'מחיסכון צבור', 'מהצבירה'),
    ytdReturn: findCol(headers, 'תשואה מתחילת השנה', 'תשואה YTD', 'מתחילת השנה'),
  };

  const funds = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every(c => c == null || normCell(c) === '')) continue;

    const get = idx => (idx >= 0 ? normCell(row[idx]) : '');
    const productName = get(col.productName);
    const productTypeRaw = get(col.productType);
    const provider = get(col.provider);
    const accountNumber = get(col.accountNumber) || null;

    if (!productName && !provider && !productTypeRaw) continue;
    if (/^סה"כ|^סיכום|^תאריך/i.test(productName)) continue;

    const parsedProduct = parseProductType(productTypeRaw || productName);
    const activityStatus = mapActivityStatus(get(col.status) || parsedProduct.status);
    const lifecycle = toFundLifecycle(activityStatus);
    const contextType = parsedProduct.cleanType || productTypeRaw || productName;

    funds.push({
      fundName: productName || `${provider} - ${contextType}`,
      fundType: resolveFundType(contextType),
      provider: provider || null,
      accountNumber,
      currentBalance: safeNum(col.balance >= 0 ? row[col.balance] : null),
      managementFeeDeposit: normalizeFeePercent(col.feeDeposit >= 0 ? row[col.feeDeposit] : null),
      managementFeeAccumulation: normalizeFeePercent(col.feeAccum >= 0 ? row[col.feeAccum] : null,
      ),
      ytdReturn: normalizePercent(col.ytdReturn >= 0 ? row[col.ytdReturn] : null),
      insuranceCoverages: [],
      ...lifecycle,
      rawData: Object.fromEntries(headers.map((h, idx) => [h || `col_${idx}`, row[idx]])),
    });
  }

  return funds;
}

function parseDepositsSheet(rows, warnings) {
  const headerIdx = findHeaderRow(rows, ['מספר פוליסה', 'תאריך', 'מעסיק', 'הפקדות']);
  if (headerIdx === -1) {
    warnings.push('לא נמצאה שורת כותרות בגיליון "מעקב הפקדות"');
    return [];
  }

  const headers = rows[headerIdx].map(h => normCell(h));
  const col = {
    accountNumber: findCol(headers, 'מספר פוליסה', 'מספר חשבון', 'חשבון'),
    valueDate: findCol(headers, 'תאריך ערך', 'תאריך'),
    salaryMonth: findCol(headers, 'חודש שכר', 'חודש'),
    employerName: findCol(headers, 'שם מעסיק', 'מעסיק'),
    employeeDeposit: findCol(headers, 'הפקדות עובד', 'הפקדת עובד', 'עובד'),
    employerDeposit: findCol(headers, 'הפקדות מעסיק', 'הפקדת מעסיק', 'מעסיק'),
    severanceDeposit: findCol(headers, 'פיצויים', 'מעסיק לפיצויים'),
  };

  const deposits = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every(c => c == null || normCell(c) === '')) continue;

    const accountNumber = col.accountNumber >= 0 ? normCell(row[col.accountNumber]) : '';
    if (!accountNumber) continue;

    deposits.push({
      accountNumber,
      valueDate: col.valueDate >= 0 ? normCell(row[col.valueDate]) : null,
      salaryMonth: col.salaryMonth >= 0 ? normCell(row[col.salaryMonth]) : null,
      employerName: col.employerName >= 0 ? normCell(row[col.employerName]) : null,
      employeeDeposit: safeNum(col.employeeDeposit >= 0 ? row[col.employeeDeposit] : null) ?? 0,
      employerDeposit: safeNum(col.employerDeposit >= 0 ? row[col.employerDeposit] : null) ?? 0,
      severanceDeposit: safeNum(col.severanceDeposit >= 0 ? row[col.severanceDeposit] : null) ?? 0,
    });
  }

  return deposits;
}

function parseInsuranceSheet(rows, warnings) {
  const headerIdx = findHeaderRow(rows, ['כיסוי', 'מספר פוליסה', 'קצבה', 'סכום']);
  if (headerIdx === -1) {
    warnings.push('לא נמצאה שורת כותרות בגיליון "כיסויים ביטוחיים"');
    return [];
  }

  const headers = rows[headerIdx].map(h => normCell(h));
  const col = {
    accountNumber: findCol(headers, 'מספר פוליסה', 'מספר חשבון', 'חשבון'),
    coverageType: findCol(headers, 'סוג הכיסוי', 'סוג כיסוי', 'כיסוי'),
    monthlyPension: findCol(headers, 'קצבה חודשית', 'קצבה'),
    lumpSum: findCol(headers, 'סכום חד פעמי', 'סכום מיידי', 'סכום'),
  };

  const coverages = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every(c => c == null || normCell(c) === '')) continue;

    const accountNumber = col.accountNumber >= 0 ? normCell(row[col.accountNumber]) : '';
    const coverageType = col.coverageType >= 0 ? normCell(row[col.coverageType]) : '';
    if (!accountNumber && !coverageType) continue;

    coverages.push({
      accountNumber,
      coverageType,
      monthlyPension: safeNum(col.monthlyPension >= 0 ? row[col.monthlyPension] : null),
      lumpSum: safeNum(col.lumpSum >= 0 ? row[col.lumpSum] : null),
    });
  }

  return coverages;
}

function attachDepositsAndCoverages(funds, deposits, coverages) {
  const byAccount = new Map(funds.map(f => [normCell(f.accountNumber), f]));

  for (const dep of deposits) {
    const fund = byAccount.get(normCell(dep.accountNumber));
    if (!fund) continue;
    if (!fund.deposits) fund.deposits = [];
    fund.deposits.push(dep);

    if (fund.activityStatus === 'ACTIVE') {
      fund.monthlyEmployeeDeposit = dep.employeeDeposit || fund.monthlyEmployeeDeposit;
      fund.monthlyEmployerDeposit = (dep.employerDeposit || 0) + (dep.severanceDeposit || 0)
        || fund.monthlyEmployerDeposit;
    }
  }

  for (const cov of coverages) {
    const fund = byAccount.get(normCell(cov.accountNumber));
    if (!fund) continue;
    fund.insuranceCoverages.push({
      coverageType: cov.coverageType,
      monthlyPension: cov.monthlyPension,
      lumpSum: cov.lumpSum,
    });
  }

  return funds;
}

/**
 * @param {Buffer} buffer
 * @returns {{ source: string, funds: object[], deposits: object[], summary: object }}
 */
function parseClearinghouseExcel(buffer) {
  const warnings = [];
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });

  const productsSheet = findSheet(workbook, SHEET_PRODUCTS);
  const depositsSheet = findSheet(workbook, SHEET_DEPOSITS);
  const insuranceSheet = findSheet(workbook, SHEET_INSURANCE);

  if (!productsSheet) {
    return {
      source: 'clearinghouse',
      funds: [],
      deposits: [],
      summary: {
        parseWarnings: ['קובץ מסלקה לא תקין — חסר גיליון "פרטי המוצרים שלי"'],
        sheetNames: workbook.SheetNames,
      },
    };
  }

  const funds = parseProductsSheet(sheetToRows(workbook, productsSheet), warnings);
  const deposits = depositsSheet
    ? parseDepositsSheet(sheetToRows(workbook, depositsSheet), warnings)
    : [];
  const coverages = insuranceSheet
    ? parseInsuranceSheet(sheetToRows(workbook, insuranceSheet), warnings)
    : [];

  attachDepositsAndCoverages(funds, deposits, coverages);

  const totalBalance = funds.reduce((s, f) => s + (f.currentBalance || 0), 0) || null;

  return {
    source: 'clearinghouse',
    funds,
    deposits,
    summary: {
      totalFunds: funds.length,
      totalBalance,
      depositRows: deposits.length,
      coverageRows: coverages.length,
      parseWarnings: warnings,
      sheetNames: workbook.SheetNames,
    },
  };
}

function isClearinghouseWorkbook(buffer) {
  try {
    const wb = XLSX.read(buffer, { type: 'buffer' });
    return Boolean(findSheet(wb, SHEET_PRODUCTS));
  } catch {
    return false;
  }
}

module.exports = {
  parseClearinghouseExcel,
  isClearinghouseWorkbook,
  mapActivityStatus,
  normCell,
};
