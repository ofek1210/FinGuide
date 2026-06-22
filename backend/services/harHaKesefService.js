/**
 * Parser for הר הכסף / pension clearing-house exports (Excel + PDF text).
 * Converts structured files into normalized fund records for PensionFund storage.
 */
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const { execFile } = require('child_process');
const XLSX = require('xlsx');

const execFileAsync = promisify(execFile);

const FUND_TYPE_KEYWORDS = [
  { keywords: ['פנסיה מקיפה', 'קרן פנסיה מקיפה'], type: 'pension_comprehensive' },
  { keywords: ['פנסיה ותיקה', 'פנסיה ישנה'], type: 'pension_old' },
  { keywords: ['ביטוח מנהלים', 'מנהלים'], type: 'managers_insurance' },
  { keywords: ['קרן השתלמות', 'השתלמות'], type: 'study_fund' },
  { keywords: ['קופת גמל', 'גמל'], type: 'provident_fund' },
];

const HEADER_KEYWORDS = [
  'חברה', 'שם קרן', 'סוג', 'יתרה', 'צבירה', 'הפקדה', 'דמי ניהול', 'מסלול', 'סטטוס',
];

function safeNum(val) {
  if (val == null || val === '' || val === '-') return null;
  const n = parseFloat(String(val).replace(/[,₪%\s]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function normalizeFee(val) {
  const n = safeNum(val);
  if (n == null) return null;
  // Har HaKesef exports fee as percentage points (0.6 = 0.6%) — store as fraction for calculationEngine
  return n / 100;
}

function resolveFundType(text = '') {
  const t = String(text).trim();
  for (const { keywords, type } of FUND_TYPE_KEYWORDS) {
    if (keywords.some(kw => t.includes(kw))) return type;
  }
  return 'other';
}

function resolveRiskLevel(track = '') {
  const t = String(track).trim();
  if (/גבוה|מניות|אגרסיב/i.test(t)) return 'high';
  if (/נמוך|סוליד|מדד/i.test(t)) return 'low';
  if (/בינונ|כללי/i.test(t)) return 'medium';
  return null;
}

function resolveActive(status = '') {
  const s = String(status).trim();
  if (!s) return true;
  if (/סגור|לא פעיל|מוקפ|inactive|closed/i.test(s)) return false;
  return /פעיל|active/i.test(s) ? true : true;
}

function findColumnIndex(headers, ...candidates) {
  for (const candidate of candidates) {
    const idx = headers.findIndex(h => h && String(h).includes(candidate));
    if (idx >= 0) return idx;
  }
  return -1;
}

function parseExportDate(rows) {
  for (const row of rows.slice(0, 6)) {
    if (!row) continue;
    for (const cell of row) {
      const s = String(cell ?? '');
      const m = s.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
      if (m) return m[1];
    }
  }
  return null;
}

function buildFundFromRow(row, colIdx, warnings) {
  const provider = String(row[colIdx.provider] ?? '').trim() || null;
  const fundName = String(row[colIdx.fundName] ?? '').trim();
  const productType = String(row[colIdx.productType] ?? '').trim();
  const accountNumber = String(row[colIdx.accountNumber] ?? '').trim() || null;

  if (!fundName && !provider) return null;

  const currentBalance = safeNum(row[colIdx.balance]);
  const monthlyEmployeeDeposit = safeNum(row[colIdx.employeeDeposit]);
  const monthlyEmployerDeposit = safeNum(row[colIdx.employerDeposit]);
  const managementFeeAccumulation = normalizeFee(row[colIdx.mgmtFeeAccum]);
  const managementFeeDeposit = normalizeFee(row[colIdx.mgmtFeeDeposit]);
  const investmentTrack = String(row[colIdx.track] ?? '').trim() || null;
  const statusRaw = String(row[colIdx.status] ?? '').trim();

  if (currentBalance == null) {
    warnings.push(`חסרה יתרה עבור ${fundName || provider}`);
  }

  return {
    fundName: fundName || `${provider} - ${productType || 'קרן'}`,
    fundType: resolveFundType(productType || fundName),
    provider,
    accountNumber,
    currentBalance,
    monthlyEmployeeDeposit,
    monthlyEmployerDeposit,
    managementFeeAccumulation,
    managementFeeDeposit,
    investmentTrack,
    riskLevel: resolveRiskLevel(investmentTrack),
    isActive: resolveActive(statusRaw),
    status: resolveActive(statusRaw) ? 'active' : 'closed',
  };
}

/**
 * Parse Excel buffer or file path.
 */
function parseHarHaKesefExcel(input) {
  const wb = Buffer.isBuffer(input)
    ? XLSX.read(input, { type: 'buffer', cellDates: true })
    : XLSX.readFile(input);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

  const exportDate = parseExportDate(rows);
  const headerRowIdx = rows.findIndex(r =>
    r && r.some(c => c && HEADER_KEYWORDS.some(kw => String(c).includes(kw)))
  );

  if (headerRowIdx === -1) {
    return {
      source: 'har_hakesef',
      exportDate,
      funds: [],
      summary: { totalFunds: 0, totalBalance: null, fundTypes: [], parseWarnings: ['לא נמצאה שורת כותרות בקובץ'] },
    };
  }

  const headers = rows[headerRowIdx].map(h => (h != null ? String(h).trim() : ''));
  const colIdx = {
    provider: findColumnIndex(headers, 'חברה מנהלת', 'חברה', 'גוף מנהל'),
    fundName: findColumnIndex(headers, 'שם קרן', 'שם המוצר', 'שם התוכנית', 'שם'),
    productType: findColumnIndex(headers, 'סוג מוצר', 'סוג קופה', 'סוג'),
    accountNumber: findColumnIndex(headers, 'מספר חשבון', 'מספר פוליסה', 'חשבון'),
    balance: findColumnIndex(headers, 'יתרה', 'צבירה', 'יתרת'),
    employeeDeposit: findColumnIndex(headers, 'הפקדת עובד', 'עובד'),
    employerDeposit: findColumnIndex(headers, 'הפקדת מעסיק', 'מעסיק'),
    mgmtFeeAccum: findColumnIndex(headers, 'דמי ניהול מצבירה', 'דמי ניהול מהצבירה', 'דמי ניהול'),
    mgmtFeeDeposit: findColumnIndex(headers, 'דמי ניהול מהפקדה', 'דמי ניהול מפרמיה'),
    track: findColumnIndex(headers, 'מסלול', 'מסלול השקעה'),
    status: findColumnIndex(headers, 'סטטוס', 'מצב'),
  };

  const warnings = [];
  const funds = [];

  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every(c => c == null || c === '')) continue;

    const firstCell = String(row[0] ?? '').trim();
    if (firstCell.startsWith('תחום') || firstCell.startsWith('סה"כ')) continue;

    const fund = buildFundFromRow(row, colIdx, warnings);
    if (fund) {
      fund.rawData = Object.fromEntries(headers.map((h, idx) => [h || `col_${idx}`, row[idx]]));
      funds.push(fund);
    }
  }

  const totalBalance = funds.reduce((s, f) => s + (f.currentBalance || 0), 0) || null;

  return {
    source: 'har_hakesef',
    exportDate,
    funds,
    summary: {
      totalFunds: funds.length,
      totalBalance,
      fundTypes: [...new Set(funds.map(f => f.fundType))],
      parseWarnings: warnings,
    },
  };
}

/**
 * Parse pdftotext layout output from Har HaKesef printed report.
 */
function parseHarHaKesefText(text) {
  const lines = String(text || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const exportDateMatch = text.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
  const exportDate = exportDateMatch ? exportDateMatch[1] : null;

  const warnings = [];
  const funds = [];

  // Skip until we pass header-like line
  let started = false;
  for (const line of lines) {
    if (!started) {
      if (/חברה|יתרה|צבירה|סוג מוצר/.test(line)) {
        started = true;
      }
      continue;
    }

    if (/^סה"כ|^תחום|^דוח|^תאריך|^תעודת/.test(line)) continue;

    // Split on 2+ spaces (table columns in -layout output)
    const parts = line.split(/\s{2,}/).map(p => p.trim()).filter(Boolean);
    if (parts.length < 3) continue;

    const [provider, fundName, productType, accountNumber, balanceStr, empDep, emplDep, feeStr, track, status] = parts;

    if (!provider || provider === 'חברה מנהלת') continue;

    const fund = {
      fundName: fundName || `${provider} - ${productType || 'קרן'}`,
      fundType: resolveFundType(productType || fundName || ''),
      provider,
      accountNumber: accountNumber || null,
      currentBalance: safeNum(balanceStr),
      monthlyEmployeeDeposit: safeNum(empDep),
      monthlyEmployerDeposit: safeNum(emplDep),
      managementFeeAccumulation: normalizeFee(feeStr),
      managementFeeDeposit: null,
      investmentTrack: track || null,
      riskLevel: resolveRiskLevel(track || ''),
      isActive: resolveActive(status || ''),
      status: resolveActive(status || '') ? 'active' : 'closed',
      rawData: { line },
    };

    if (fund.currentBalance == null) {
      warnings.push(`חסרה יתרה עבור ${fund.fundName}`);
    }

    funds.push(fund);
  }

  const totalBalance = funds.reduce((s, f) => s + (f.currentBalance || 0), 0) || null;

  return {
    source: 'har_hakesef',
    exportDate,
    funds,
    summary: {
      totalFunds: funds.length,
      totalBalance,
      fundTypes: [...new Set(funds.map(f => f.fundType))],
      parseWarnings: warnings,
    },
  };
}

async function extractPdfText(filePath) {
  try {
    const { stdout } = await execFileAsync('pdftotext', ['-layout', filePath, '-']);
    return stdout || '';
  } catch {
    return '';
  }
}

/**
 * Unified entry: buffer/path + extension.
 * @param {Buffer|string} input
 * @param {{ ext?: string, originalName?: string }} opts
 */
async function parseHarHaKesef(input, opts = {}) {
  const ext = (opts.ext || path.extname(opts.originalName || '')).toLowerCase();
  const importSource = opts.importSource || 'har_hakesef';

  if (ext === '.xlsx' || ext === '.xls') {
    const result = parseHarHaKesefExcel(input);
    if (importSource === 'quarterly_report') {
      return {
        ...result,
        source: 'quarterly_report',
        funds: result.funds.map(f => ({ ...f, source: 'quarterly_report' })),
      };
    }
    return result;
  }

  if (ext === '.pdf') {
    let text = '';
    if (Buffer.isBuffer(input)) {
      const tmpPath = path.join(require('os').tmpdir(), `har-kesef-${Date.now()}.pdf`);
      await fs.promises.writeFile(tmpPath, input);
      try {
        text = await extractPdfText(tmpPath);
      } finally {
        await fs.promises.unlink(tmpPath).catch(() => {});
      }
    } else if (typeof input === 'string') {
      text = await extractPdfText(input);
    }

    if (text.length < 80) {
      return {
        source: 'har_hakesef',
        exportDate: null,
        funds: [],
        summary: {
          totalFunds: 0,
          totalBalance: null,
          fundTypes: [],
          parseWarnings: ['לא הצלחנו לחלץ טקסט מה-PDF. נסה להעלות קובץ Excel או PDF עם טקסט ניתן לחילוץ.'],
        },
      };
    }

    if (importSource === 'quarterly_report') {
      const { parseQuarterlyReportText } = require('./pensionQuarterlyReportService');
      return parseQuarterlyReportText(text, opts.originalName);
    }

    const textResult = parseHarHaKesefText(text);
    if (textResult.funds.length === 0 && importSource !== 'har_hakesef') {
      const { parseQuarterlyReportText } = require('./pensionQuarterlyReportService');
      return parseQuarterlyReportText(text, opts.originalName);
    }
    return textResult;
  }

  if (ext === '.txt') {
    if (importSource !== 'quarterly_report') {
      throw new Error('סוג קובץ לא נתמך');
    }
    let text = '';
    if (Buffer.isBuffer(input)) {
      text = input.toString('utf8');
    } else if (typeof input === 'string') {
      text = await fs.promises.readFile(input, 'utf8');
    }
    const { parseQuarterlyReportText } = require('./pensionQuarterlyReportService');
    return parseQuarterlyReportText(text, opts.originalName);
  }

  throw new Error('סוג קובץ לא נתמך');
}

module.exports = {
  parseHarHaKesef,
  parseHarHaKesefExcel,
  parseHarHaKesefText,
  resolveFundType,
};
