

const { resolvePayslipPeriod, monthKey, compareYearMonth, selectLatestDoc } = require('./payslipPeriod');

function isPayslipCategory(doc) {
  const cat = doc?.metadata?.category;
  if (cat && cat !== 'payslip') return false;
  return true;
}

function isAnalyzablePayslip(doc) {
  if (!doc) return false;
  if (doc.status !== 'completed' && doc.status !== 'needs_review') return false;
  if (!doc.analysisData || typeof doc.analysisData !== 'object') return false;
  return isPayslipCategory(doc);
}

/**
 * Pick the N most recent payslips by salary period (not upload date).
 * Dedupes multiple uploads for the same month — keeps the latest upload.
 */
function selectRecentPayslipDocuments(documents, limit = 3) {
  const valid = (documents || []).filter(isAnalyzablePayslip);
  const byPeriod = new Map();

  for (const doc of valid) {
    const period = resolvePayslipPeriod(doc);
    if (period.incompletePeriod || period.year == null || period.month == null) {
      continue;
    }
    const key = monthKey(period.year, period.month);
    const existing = byPeriod.get(key);
    byPeriod.set(key, existing ? selectLatestDoc(existing, doc) : doc);
  }

  const withIncomplete = valid.filter(doc => {
    const period = resolvePayslipPeriod(doc);
    return period.incompletePeriod;
  });

  const deduped = [...byPeriod.entries()]
    .sort(([keyA], [keyB]) => {
      const [yearA, monthA] = keyA.split('-').map(Number);
      const [yearB, monthB] = keyB.split('-').map(Number);
      return compareYearMonth({ year: yearB, month: monthB }, { year: yearA, month: monthA });
    })
    .map(([, doc]) => doc);

  const fallbackByUpload = [...withIncomplete].sort((a, b) => {
    const ta = new Date(a.uploadedAt || a.createdAt || 0).getTime();
    const tb = new Date(b.uploadedAt || b.createdAt || 0).getTime();
    return tb - ta;
  });

  const merged = [...deduped, ...fallbackByUpload];
  return merged.slice(0, limit);
}

module.exports = {
  isAnalyzablePayslip,
  isPayslipCategory,
  selectRecentPayslipDocuments,
};
