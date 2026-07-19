'use strict';

/**
 * Compound monthly returns (percent values as stored in Pensia-Net / CKAN).
 * Does NOT concatenate or sum — uses multiplicative compounding.
 */

/**
 * @param {number} year
 * @param {number} month 1-12
 * @returns {number}
 */
function monthIndex(year, month) {
  return year * 12 + month;
}

/**
 * @param {number} reportPeriod YYYYMM
 * @returns {{ year: number, month: number, reportPeriod: number }|null}
 */
function parseReportPeriod(reportPeriod) {
  const n = Number(reportPeriod);
  if (!Number.isFinite(n)) return null;
  const s = String(Math.trunc(n));
  if (s.length !== 6) return null;
  const year = Number(s.slice(0, 4));
  const month = Number(s.slice(4, 6));
  if (month < 1 || month > 12 || year < 1990 || year > 2100) return null;
  return { year, month, reportPeriod: year * 100 + month };
}

/**
 * @param {{ reportPeriod: number, monthlyYield: number|null }[]} rows — newest first
 * @param {number} requiredMonths — 12, 36, or 60
 * @returns {{ compoundedReturnPct: number|null, monthsUsed: number, complete: boolean, missingMonths: boolean }}
 */
function computeCompoundedReturn(rows, requiredMonths) {
  if (!Array.isArray(rows) || rows.length < requiredMonths) {
    return { compoundedReturnPct: null, monthsUsed: rows?.length || 0, complete: false, missingMonths: true };
  }

  const slice = rows.slice(0, requiredMonths);
  const periods = slice.map(r => parseReportPeriod(r.reportPeriod)).filter(Boolean);
  if (periods.length !== requiredMonths) {
    return { compoundedReturnPct: null, monthsUsed: periods.length, complete: false, missingMonths: true };
  }

  for (let i = 0; i < requiredMonths - 1; i += 1) {
    const cur = monthIndex(periods[i].year, periods[i].month);
    const prev = monthIndex(periods[i + 1].year, periods[i + 1].month);
    if (cur - prev !== 1) {
      return { compoundedReturnPct: null, monthsUsed: requiredMonths, complete: false, missingMonths: true };
    }
  }

  let product = 1;
  for (const row of slice) {
    if (row.monthlyYield == null || !Number.isFinite(row.monthlyYield)) {
      return { compoundedReturnPct: null, monthsUsed: requiredMonths, complete: false, missingMonths: true };
    }
    product *= (1 + row.monthlyYield / 100);
  }

  const compoundedReturnPct = Math.round((product - 1) * 10000) / 100;
  return {
    compoundedReturnPct,
    monthsUsed: requiredMonths,
    complete: true,
    missingMonths: false,
  };
}

/**
 * Build compounded windows for a track's monthly history.
 * @param {{ reportPeriod: number, monthlyYield: number|null }[]} rows — newest first
 */
function buildCompoundedWindows(rows) {
  const windows = [12, 36, 60];
  const out = {};
  for (const m of windows) {
    out[`return${m}M`] = computeCompoundedReturn(rows, m);
  }
  const latest = rows[0];
  const parsed = latest ? parseReportPeriod(latest.reportPeriod) : null;
  return {
    ...out,
    lastReportPeriod: latest?.reportPeriod ?? null,
    lastReportDate: parsed ? `${parsed.year}-${String(parsed.month).padStart(2, '0')}` : null,
    totalMonthsStored: rows.length,
  };
}

module.exports = {
  monthIndex,
  parseReportPeriod,
  computeCompoundedReturn,
  buildCompoundedWindows,
};
