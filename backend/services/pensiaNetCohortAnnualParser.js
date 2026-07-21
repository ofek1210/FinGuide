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
  if (v == null || v === '') return null;
  const n = Number(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

/**
 * Parse Pensia-Net Excel export tsuotHodPtihaRDL.xls
 * ("סה\"כ נכסים ותשואות - לפי סוג קרן").
 * @param {Buffer} buffer
 * @param {{ sourceFile?: string }} [opts]
 * @returns {{ rows: object[], meta: object, warnings: string[] }}
 */
function parsePensiaNetCohortAnnualExcel(buffer, opts = {}) {
  const warnings = [];
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: false });
  const sheetName = wb.SheetNames.find(n => /tsuot|hod|ptiha/i.test(n)) || wb.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '' });

  let reportLabel = null;
  let reportAsOf = null;
  let trailing12General = null;
  let trailing12New = null;

  for (const row of rows) {
    const text = row.map(cellStr).join(' ');
    if (text.includes('סה"כ נכסים ותשואות')) reportLabel = text;
    if (text.includes('נכון לסוף')) {
      const m = text.match(/נכון לסוף\s+(.+?)(?:\s*$)/);
      reportAsOf = m ? m[1].trim() : text.replace(/.*נכון לסוף\s*/, '').trim();
    }
    if (text.includes('12 חודשים') && text.includes('קרנות כלליות')) {
      const nums = row.map(parseNum).filter(v => v != null);
      if (nums.length) trailing12General = nums[0];
    }
    if (text.includes('12 חודשים') && text.includes('קרנות חדשות')) {
      const nums = row.map(parseNum).filter(v => v != null);
      if (nums.length >= 2) trailing12New = nums[nums.length - 1];
      else if (nums.length === 1) trailing12New = nums[0];
    }
  }

  const annualRows = [];
  for (const row of rows) {
    const year = parseYear(row[15] ?? row[14] ?? row[row.length - 1]);
    if (!year || year < 1990 || year > 2100) continue;

    const returnGeneral = parseNum(row[7]);
    const returnNew = parseNum(row[9]);
    const assetsGeneral = parseNum(row[10]);
    const assetsNew = parseNum(row[12]);

    if (returnGeneral == null && returnNew == null) continue;

    annualRows.push({
      year,
      returnPctGeneral: returnGeneral,
      returnPctNew: returnNew,
      assetsGeneralMillions: assetsGeneral,
      assetsNewMillions: assetsNew,
    });
  }

  if (trailing12General != null || trailing12New != null) {
    const maxYear = annualRows.length ? Math.max(...annualRows.map(r => r.year)) : null;
    const latest = maxYear != null ? annualRows.find(r => r.year === maxYear) : null;
    if (latest) {
      latest.trailing12mReturnGeneral = trailing12General;
      latest.trailing12mReturnNew = trailing12New;
    }
  }

  if (!annualRows.length) {
    warnings.push('לא זוהו שורות שנתיות — ודא שזה דוח tsuotHodPtihaRDL מפנסיה-נט');
  }

  return {
    rows: annualRows,
    meta: {
      source: 'pensyanet_excel',
      sourceFile: opts.sourceFile || null,
      sheetName,
      reportLabel,
      reportAsOf,
    },
    warnings,
  };
}

module.exports = { parsePensiaNetCohortAnnualExcel };
