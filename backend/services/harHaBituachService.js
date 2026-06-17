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

/**
 * Parse an HbResults XLSX file and return structured analysisData.
 */
function parseHarHaBituach(filePath) {
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

  // Extract export date from row 0
  const exportDate = rows[0]?.[5] || null;

  // Find header row (contains "ענף ראשי")
  const headerRowIdx = rows.findIndex(r => r && r.includes('ענף ראשי'));
  if (headerRowIdx === -1) {
    return { policies: [], exportDate, rawRowCount: rows.length };
  }

  const headers = rows[headerRowIdx];
  const colIdx = {};
  headers.forEach((h, i) => { if (h) colIdx[String(h).trim()] = i; });

  const policies = [];
  let currentMainBranch = '';
  let totalMonthlyPremium = 0;
  let totalAnnualPremium = 0;

  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every(c => c == null || c === '')) continue;

    // Category separator rows (e.g. "תחום - בריאות ותאונות אישיות")
    const firstCell = String(row[colIdx['תעודת זהות'] ?? 0] ?? '').trim();
    const mainBranchCell = String(row[colIdx['ענף ראשי'] ?? 1] ?? '').trim();

    if (!firstCell && mainBranchCell.startsWith('תחום')) {
      currentMainBranch = mainBranchCell.replace('תחום -', '').trim();
      continue;
    }

    const company = String(row[colIdx['חברה']] ?? '').trim();
    const productType = String(row[colIdx['סוג מוצר']] ?? '').trim();
    const subBranch = String(row[colIdx['ענף (משני)']] ?? '').trim();
    const periodStr = String(row[colIdx['תקופת ביטוח']] ?? '').trim();
    const premiumRaw = row[colIdx['פרמיה בש"ח']];
    const premiumType = String(row[colIdx['סוג פרמיה']] ?? '').trim();
    const policyNumber = String(row[colIdx['מספר פוליסה']] ?? '').trim();
    const planClass = String(row[colIdx['סיווג תכנית']] ?? '').trim();
    const extra = String(row[colIdx['פרטים נוספים']] ?? '').trim();

    if (!company && !policyNumber) continue;

    const premium = typeof premiumRaw === 'number' ? premiumRaw : parseFloat(String(premiumRaw ?? '').replace(/,/g, '')) || null;
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

module.exports = { parseHarHaBituach };
