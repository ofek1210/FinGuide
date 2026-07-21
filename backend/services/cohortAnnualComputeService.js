'use strict';

function toNum(v) {
  if (v == null || v === '' || v === '---') return null;
  const n = Number(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

function parseYear(v) {
  const s = String(v ?? '').trim();
  const m = s.match(/(\d{4})/);
  return m ? Number(m[1]) : null;
}

function cellStr(v) {
  return String(v ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * Compound monthly yields (percent units, e.g. 0.5 = 0.5%).
 * @param {number[]} yields
 */
function compoundMonthlyYields(yields) {
  if (!yields.length) return null;
  let factor = 1;
  for (const y of yields) {
    if (y == null || !Number.isFinite(y)) return null;
    factor *= (1 + y / 100);
  }
  return (factor - 1) * 100;
}

function parseReportPeriod(v) {
  const n = Number(String(v ?? '').replace(/\D/g, ''));
  if (!Number.isFinite(n) || n < 190001) return null;
  const year = Math.floor(n / 100);
  const month = n % 100;
  if (month < 1 || month > 12) return null;
  return { year, month, period: year * 100 + month };
}

function classifyPensiaFund(classification) {
  const c = String(classification || '');
  if (/קרנות\s*חדשות/.test(c)) return 'new';
  if (/קרנות\s*כלליות/.test(c)) return 'general';
  return null;
}

function classifyGemelFund(classification) {
  const c = String(classification || '').trim();
  if (!c) return null;
  if (/השתלמות/.test(c)) return 'histalmut';
  if (/תגמולים/.test(c)) return 'tagmulim';
  if (/מרכזית/.test(c)) return 'merkazit';
  if (/חסכון לילד/.test(c)) return 'child_savings';
  if (/מטרה אחרת/.test(c)) return 'other_goal';
  if (/קופ"ג להשקעה/.test(c) && !/ילד/.test(c)) return 'investment';
  return 'other';
}

/**
 * Asset-weighted average.
 */
function weightedAverage(items, valueKey, weightKey) {
  let sumW = 0;
  let sumV = 0;
  for (const item of items) {
    const v = item[valueKey];
    const w = item[weightKey];
    if (v == null || w == null || w <= 0) continue;
    sumV += v * w;
    sumW += w;
  }
  return sumW > 0 ? sumV / sumW : null;
}

/**
 * Compute Pensia-Net cohort annual rows from CKAN monthly records.
 * Mirrors tsuotHodPtihaRDL.xls ("קרנות כלליות" / "קרנות חדשות").
 *
 * @param {object[]} records — raw CKAN rows
 * @returns {{ rows: object[], meta: object }}
 */
function computePensiaCohortAnnualFromCkan(records) {
  const byFundYear = new Map();

  for (const row of records) {
    const cohort = classifyPensiaFund(row.FUND_CLASSIFICATION);
    if (!cohort) continue;

    const period = parseReportPeriod(row.REPORT_PERIOD);
    if (!period) continue;

    const fundId = String(row.FUND_ID);
    const key = `${fundId}:${period.year}`;
    const monthlyYield = toNum(row.MONTHLY_YIELD);
    const assets = toNum(row.TOTAL_ASSETS);

    if (!byFundYear.has(key)) {
      byFundYear.set(key, {
        fundId,
        year: period.year,
        cohort,
        months: [],
        decAssets: null,
        decYtd: null,
      });
    }

    const entry = byFundYear.get(key);
    if (monthlyYield != null) {
      entry.months.push({ month: period.month, yield: monthlyYield });
    }
    if (period.month === 12 || entry.decAssets == null) {
      if (assets != null) entry.decAssets = assets;
      const ytd = toNum(row.YEAR_TO_DATE_YIELD);
      if (ytd != null) entry.decYtd = ytd;
    }
  }

  const years = [...new Set([...byFundYear.values()].map(v => v.year))].sort();
  const annualRows = [];

  for (const year of years) {
    const generalFunds = [];
    const newFunds = [];

    for (const entry of byFundYear.values()) {
      if (entry.year !== year) continue;
      entry.months.sort((a, b) => a.month - b.month);
      const annualReturn = compoundMonthlyYields(entry.months.map(m => m.yield))
        ?? entry.decYtd;
      const payload = { annualReturn, assets: entry.decAssets };
      if (entry.cohort === 'general') generalFunds.push(payload);
      else if (entry.cohort === 'new') newFunds.push(payload);
    }

    annualRows.push({
      year,
      returnPctGeneral: weightedAverage(generalFunds, 'annualReturn', 'assets'),
      returnPctNew: weightedAverage(newFunds, 'annualReturn', 'assets'),
      assetsGeneralMillions: generalFunds.reduce((s, f) => s + (f.assets || 0), 0) || null,
      assetsNewMillions: newFunds.reduce((s, f) => s + (f.assets || 0), 0) || null,
    });
  }

  const latestPeriod = records
    .map(r => parseReportPeriod(r.REPORT_PERIOD))
    .filter(Boolean)
    .sort((a, b) => b.period - a.period)[0];

  return {
    rows: annualRows.filter(r => r.returnPctGeneral != null || r.returnPctNew != null),
    meta: {
      source: 'data_gov_computed',
      computedAt: new Date().toISOString(),
      latestReportPeriod: latestPeriod ? latestPeriod.period : null,
      fundRowsProcessed: records.length,
    },
  };
}

/**
 * Compute Gemel-Net cohort annual rows from CKAN monthly records.
 * @param {object[]} records
 */
function computeGemelCohortAnnualFromCkan(records) {
  const byFundYear = new Map();

  for (const row of records) {
    const cohortKey = classifyGemelFund(row.FUND_CLASSIFICATION);
    if (!cohortKey) continue;

    const period = parseReportPeriod(row.REPORT_PERIOD);
    if (!period) continue;

    const fundId = String(row.FUND_ID);
    const key = `${fundId}:${period.year}`;
    const monthlyYield = toNum(row.MONTHLY_YIELD);
    const assets = toNum(row.TOTAL_ASSETS);

    if (!byFundYear.has(key)) {
      byFundYear.set(key, {
        year: period.year,
        cohortKey,
        months: [],
        decAssets: null,
        decYtd: null,
      });
    }

    const entry = byFundYear.get(key);
    if (monthlyYield != null) entry.months.push({ month: period.month, yield: monthlyYield });
    if (assets != null) entry.decAssets = assets;
    const ytd = toNum(row.YEAR_TO_DATE_YIELD);
    if (ytd != null) entry.decYtd = ytd;
  }

  const years = [...new Set([...byFundYear.values()].map(v => v.year))].sort();
  const annualRows = [];

  for (const year of years) {
    const byCohort = {};
    for (const entry of byFundYear.values()) {
      if (entry.year !== year) continue;
      entry.months.sort((a, b) => a.month - b.month);
      const annualReturn = compoundMonthlyYields(entry.months.map(m => m.yield)) ?? entry.decYtd;
      if (!byCohort[entry.cohortKey]) byCohort[entry.cohortKey] = [];
      byCohort[entry.cohortKey].push({ annualReturn, assets: entry.decAssets });
    }

    const totalItems = Object.values(byCohort).flat();
    annualRows.push({
      year,
      returnPctTotal: weightedAverage(totalItems, 'annualReturn', 'assets'),
      assetsTotalMillions: totalItems.reduce((s, f) => s + (f.assets || 0), 0) || null,
      assetsTagmulimMillions: (byCohort.tagmulim || []).reduce((s, f) => s + (f.assets || 0), 0) || null,
      assetsHistalmutMillions: (byCohort.histalmut || []).reduce((s, f) => s + (f.assets || 0), 0) || null,
      assetsMerkazitMillions: (byCohort.merkazit || []).reduce((s, f) => s + (f.assets || 0), 0) || null,
      assetsInvestmentMillions: (byCohort.investment || []).reduce((s, f) => s + (f.assets || 0), 0) || null,
      assetsChildSavingsMillions: (byCohort.child_savings || []).reduce((s, f) => s + (f.assets || 0), 0) || null,
    });
  }

  return {
    rows: annualRows.filter(r => r.returnPctTotal != null),
    meta: {
      source: 'data_gov_computed',
      computedAt: new Date().toISOString(),
      fundRowsProcessed: records.length,
    },
  };
}

module.exports = {
  computePensiaCohortAnnualFromCkan,
  computeGemelCohortAnnualFromCkan,
  compoundMonthlyYields,
  classifyPensiaFund,
  classifyGemelFund,
};
