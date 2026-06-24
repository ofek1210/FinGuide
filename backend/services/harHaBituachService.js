/**
 * Parser for הר הביטוח (Har HaBitua) XLSX exports from Israel's Ministry of Finance.
 * Converts the structured Excel file into the app's standard analysisData format.
 */
const XLSX = require('xlsx');

// Map Hebrew branch names to internal types
const BRANCH_TYPE_MAP = {
  'בריאות ותאונות אישיות': 'health',
  'ביטוח חיים': 'life',
  'רכב': 'car',
  'דירה': 'apartment',
  'אחריות': 'liability',
  'נסיעות לחול': 'travel',
  'פנסיה': 'pension',
  'גמל': 'savings',
  'השתלמות': 'training_fund',
};

function resolveBranchType(mainBranch = '', subBranch = '') {
  const text = `${mainBranch} ${subBranch}`.trim();
  for (const [key, val] of Object.entries(BRANCH_TYPE_MAP)) {
    if (text.includes(key)) return val;
  }
  return 'other';
}

function parsePremiumPeriod(periodStr = '') {
  // Format: "01/01/2026 - 31/12/2026" or similar
  const match = /(\d{2}\/\d{2}\/\d{4})\s*-\s*(\d{2}\/\d{2}\/\d{4})/.exec(periodStr);
  if (!match) return {};
  const parse = s => {
    const [d, m, y] = s.split('/');
    return `${y}-${m}-${d}`;
  };
  return { from: parse(match[1]), to: parse(match[2]) };
}

function rowHasHeader(rows, needle) {
  return rows.some(r => Array.isArray(r) && r.some(c => String(c ?? '').includes(needle)));
}

/** Find column index where header cell includes any of the needles */
function findCol(headers, ...needles) {
  for (let i = 0; i < headers.length; i++) {
    const h = String(headers[i] ?? '').trim();
    if (!h) continue;
    if (needles.some(n => h.includes(n))) return i;
  }
  return undefined;
}

function parseHarHaBituachRows(rows) {
  const exportDate = rows[0]?.[5] || null;

  const headerRowIdx = rows.findIndex(
    r => Array.isArray(r) && r.some(c => String(c ?? '').includes('ענף ראשי')),
  );
  if (headerRowIdx === -1) {
    return { policies: [], exportDate, rawRowCount: rows.length };
  }

  const headers = rows[headerRowIdx];
  const col = {
    id: findCol(headers, 'תעודת זהות') ?? 0,
    mainBranch: findCol(headers, 'ענף ראשי') ?? 1,
    company: findCol(headers, 'חברה'),
    productType: findCol(headers, 'סוג מוצר'),
    subBranch: findCol(headers, 'ענף', 'משני'),
    period: findCol(headers, 'תקופת ביטוח'),
    premium: findCol(headers, 'פרמיה'),
    premiumType: findCol(headers, 'סוג פרמיה'),
    policyNumber: findCol(headers, 'מספר פוליסה', 'פוליסה'),
    planClass: findCol(headers, 'סיווג תכנית'),
    extra: findCol(headers, 'פרטים נוספים'),
  };

  const policies = [];
  let currentMainBranch = '';
  let totalMonthlyPremium = 0;
  let totalAnnualPremium = 0;

  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every(c => c == null || c === '')) continue;

    const firstCell = String(row[col.id] ?? '').trim();
    const mainBranchCell = String(row[col.mainBranch] ?? '').trim();

    if (!firstCell && mainBranchCell.startsWith('תחום')) {
      currentMainBranch = mainBranchCell.replace(/^תחום\s*-\s*/, '').trim();
      continue;
    }

    const company = col.company != null ? String(row[col.company] ?? '').trim() : '';
    const productType = col.productType != null ? String(row[col.productType] ?? '').trim() : '';
    const subBranch = col.subBranch != null ? String(row[col.subBranch] ?? '').trim() : '';
    const periodStr = col.period != null ? String(row[col.period] ?? '').trim() : '';
    const premiumRaw = col.premium != null ? row[col.premium] : null;
    const premiumType = col.premiumType != null ? String(row[col.premiumType] ?? '').trim() : '';
    const policyNumber = col.policyNumber != null ? String(row[col.policyNumber] ?? '').trim() : '';
    const planClass = col.planClass != null ? String(row[col.planClass] ?? '').trim() : '';
    const extra = col.extra != null ? String(row[col.extra] ?? '').trim() : '';

    if (!company && !policyNumber) continue;

    const premium = typeof premiumRaw === 'number'
      ? premiumRaw
      : parseFloat(String(premiumRaw ?? '').replace(/[,₪\s]/g, '')) || null;
    const period = parsePremiumPeriod(periodStr);
    const branchType = resolveBranchType(currentMainBranch, subBranch);

    const isMonthly = premiumType.includes('חודשי');
    const isAnnual = premiumType.includes('שנתי');
    if (premium != null) {
      if (isMonthly) totalMonthlyPremium += premium;
      if (isAnnual) totalAnnualPremium += premium / 12;
    }

    policies.push({
      branchType,
      mainBranch: currentMainBranch,
      subBranch,
      productType,
      company,
      policyNumber,
      planClass,
      premium,
      premiumType,
      period,
      extra,
    });
  }

  const estimatedMonthlyTotal = Math.round(totalMonthlyPremium + totalAnnualPremium);

  return {
    source: 'har_habitua',
    exportDate,
    policies,
    summary: {
      totalPolicies: policies.length,
      estimatedMonthlyPremium: estimatedMonthlyTotal || null,
      hasHealthInsurance: policies.some(p => p.branchType === 'health'),
      hasLifeInsurance: policies.some(p => p.branchType === 'life'),
      hasPension: policies.some(p => p.branchType === 'pension'),
      hasCarInsurance: policies.some(p => p.branchType === 'car'),
      hasApartmentInsurance: policies.some(p => p.branchType === 'apartment'),
      companies: [...new Set(policies.map(p => p.company).filter(Boolean))],
    },
  };
}

function readWorkbookRows(workbook) {
  const ws = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
}

function parseHarHaBituachBuffer(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  return parseHarHaBituachRows(readWorkbookRows(wb));
}

function isHarHaBituachBuffer(buffer) {
  try {
    const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const rows = readWorkbookRows(wb);
    return rowHasHeader(rows, 'ענף ראשי');
  } catch {
    return false;
  }
}

/**
 * Parse an HbResults XLSX file and return structured analysisData.
 */
function parseHarHaBituach(filePath) {
  const wb = XLSX.readFile(filePath);
  return parseHarHaBituachRows(readWorkbookRows(wb));
}

module.exports = {
  parseHarHaBituach,
  parseHarHaBituachBuffer,
  isHarHaBituachBuffer,
  parseHarHaBituachRows,
};
