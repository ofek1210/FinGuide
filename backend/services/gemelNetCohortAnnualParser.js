'use strict';

const XLSX = require('xlsx');

function cellStr(v) {
  return String(v ?? '').replace(/\s+/g, ' ').trim();
}

function parseYear(v) {
  const s = cellStr(v);
  const m = s.match(/(\d{4})/);
  return m ? Number(m[1]) : null;
}

function parseNum(v) {
  if (v == null || v === '' || v === '---') return null;
  const n = Number(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

/**
 * Parse Gemel-Net Excel export tsuotHodPtihaRDL.xls
 * ("סה\"כ נכסי הקופות - לפי סוג קופה").
 * @param {Buffer} buffer
 * @param {{ sourceFile?: string }} [opts]
 */
function parseGemelNetCohortAnnualExcel(buffer, opts = {}) {
  const warnings = [];
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: false });
  const sheetName = wb.SheetNames.find(n => /tsuot|hod|ptiha/i.test(n)) || wb.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '' });

  let reportLabel = null;
  let reportAsOf = null;
  let trailing12Return = null;

  for (const row of rows) {
    const text = row.map(cellStr).join(' ');
    if (text.includes('סה"כ נכסי הקופות')) reportLabel = text;
    if (text.includes('נכון לסוף')) {
      const m = text.match(/נכון לסוף\s+(.+?)(?:\s*$)/);
      reportAsOf = m ? m[1].trim() : text.replace(/.*נכון לסוף\s*/, '').trim();
    }
    if (text.includes('12 חודשים') && text.includes('תשואה')) {
      const nums = row.map(parseNum).filter(v => v != null);
      if (nums.length) trailing12Return = nums[0];
    }
  }

  const annualRows = [];
  for (const row of rows) {
    const year = parseYear(row[18] ?? row[17] ?? row[row.length - 1]);
    if (!year || year < 1990 || year > 2100) continue;

    const returnTotal = parseNum(row[6]);
    const assetsTotal = parseNum(row[7]);
    const assetsChild = parseNum(row[8]);
    const assetsInvestment = parseNum(row[11]);
    const assetsOtherGoal = parseNum(row[12]);
    const assetsMerkazit = parseNum(row[14]);
    const assetsHistalmut = parseNum(row[15]);
    const assetsTagmulim = parseNum(row[17]);

    if (returnTotal == null && assetsTotal == null) continue;

    annualRows.push({
      year,
      returnPctTotal: returnTotal,
      assetsTotalMillions: assetsTotal,
      assetsChildSavingsMillions: assetsChild,
      assetsInvestmentMillions: assetsInvestment,
      assetsOtherGoalMillions: assetsOtherGoal,
      assetsMerkazitMillions: assetsMerkazit,
      assetsHistalmutMillions: assetsHistalmut,
      assetsTagmulimMillions: assetsTagmulim,
    });
  }

  if (trailing12Return != null && annualRows.length) {
    const maxYear = Math.max(...annualRows.map(r => r.year));
    const latest = annualRows.find(r => r.year === maxYear);
    if (latest) latest.trailing12mReturnTotal = trailing12Return;
  }

  if (!annualRows.length) {
    warnings.push('לא זוהו שורות שנתיות — ודא שזה דוח tsuotHodPtihaRDL מגמל-נט');
  }

  return {
    rows: annualRows,
    meta: {
      source: 'gemelnet_excel',
      sourceFile: opts.sourceFile || null,
      sheetName,
      reportLabel,
      reportAsOf,
    },
    warnings,
  };
}

module.exports = { parseGemelNetCohortAnnualExcel };
