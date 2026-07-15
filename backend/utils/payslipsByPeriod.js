const { canonicalPeriodMonth, monthKey } = require('./payslipPeriod');

function buildPayslipsByPeriod(documents) {
  const byPeriod = {};
  for (const doc of documents || []) {
    const key = canonicalPeriodMonth(doc.analysisData?.period?.month)
      || (doc.metadata?.periodYear && doc.metadata?.periodMonth
        ? monthKey(doc.metadata.periodYear, doc.metadata.periodMonth)
        : null);
    if (!key || byPeriod[key]) continue;
    const s = doc.analysisData?.summary || {};
    byPeriod[key] = {
      netSalary: s.netSalary ?? null,
      grossSalary: s.grossSalary ?? null,
    };
  }
  return byPeriod;
}

module.exports = { buildPayslipsByPeriod };
