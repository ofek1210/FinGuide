'use strict';

const { resolvePayslipPeriod, monthKey, selectLatestDoc } = require('./payslipPeriod');
const { enrichSummary } = require('./payslipEnrichment');

/**
 * Map documents → { "YYYY-MM": { netSalary, grossSalary, tax } } for agents /
 * copilot monthly joins. Uses the same period resolution as tax assistant
 * (metadata → analysis → summary.date → filename) and enrichSummary so
 * salary.* fields count even when summary.* is empty.
 */
function buildPayslipsByPeriod(documents) {
  const byPeriod = new Map();

  for (const doc of documents || []) {
    const period = resolvePayslipPeriod(doc);
    if (period.incompletePeriod || period.year == null || period.month == null) {
      continue;
    }

    const key = monthKey(period.year, period.month);
    const existing = byPeriod.get(key);
    const chosen = existing ? selectLatestDoc(existing.doc, doc) : doc;
    byPeriod.set(key, { doc: chosen });
  }

  const result = {};
  for (const [key, { doc }] of byPeriod.entries()) {
    const summary = enrichSummary(doc);
    result[key] = {
      netSalary: summary.netSalary ?? null,
      grossSalary: summary.grossSalary ?? null,
      tax: summary.tax ?? null,
    };
  }
  return result;
}

module.exports = { buildPayslipsByPeriod };
