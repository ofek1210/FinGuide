const { calculateAnnualTaxAdjustment } = require('./taxAdjustmentRulesService');
const {
  resolvePayslipPeriod,
  selectLatestDoc,
} = require('../utils/payslipPeriod');
const { enrichSummary } = require('../utils/payslipEnrichment');

const monthSet = new Set(Array.from({ length: 12 }, (_, i) => i + 1));

function computeAverage(values) {
  const valid = values.filter(Number.isFinite);
  if (!valid.length) return null;
  const total = valid.reduce((sum, value) => sum + value, 0);
  return Math.round((total / valid.length) * 100) / 100;
}

function computeSum(values) {
  const valid = values.filter(Number.isFinite);
  if (!valid.length) return 0;
  return Math.round(valid.reduce((sum, value) => sum + value, 0) * 100) / 100;
}

// Critical fields the OCR/LLM extraction targets (mirrors payslipAnalysis.schema).
// period.month is the grouping key; gross/net are the in-row criticals we can flag.
function computeMissingCritical(entry) {
  const missing = [];
  if (!Number.isFinite(entry.summary.grossSalary)) missing.push('grossSalary');
  if (!Number.isFinite(entry.summary.netSalary)) missing.push('netSalary');
  return missing;
}

function buildPayslipHistoryIntelligence(documents, { year } = {}) {
  // Include needs_review docs too — those are payslips where the extraction ran
  // but a critical field failed validation, i.e. exactly what we want to surface
  // and let the user complete manually.
  const completed = (documents || []).filter(
    doc =>
      (doc?.status === 'completed' || doc?.status === 'needs_review') &&
      doc?.analysisData &&
      typeof doc.analysisData === 'object',
  );

  const resolved = completed.map(doc => ({
    doc,
    period: resolvePayslipPeriod(doc),
    summary: enrichSummary(doc),
  }));

  const incompletePeriods = resolved
    .filter(entry => entry.period.incompletePeriod)
    .map(entry => ({
      documentId: entry.doc._id?.toString?.() || entry.doc._id,
      originalName: entry.doc.originalName || null,
      uploadedAt: entry.doc.uploadedAt || null,
      reason: 'missing_or_invalid_period',
    }));

  const validEntries = resolved.filter(entry => !entry.period.incompletePeriod);
  const dedupedByMonth = new Map();
  for (const entry of validEntries) {
    const key = `${entry.period.year}-${String(entry.period.month).padStart(2, '0')}`;
    const existing = dedupedByMonth.get(key);
    dedupedByMonth.set(key, existing ? selectLatestDoc(existing.doc, entry.doc) === entry.doc ? entry : existing : entry);
  }

  const dedupedEntries = [...dedupedByMonth.values()];
  const yearsMap = new Map();
  for (const entry of dedupedEntries) {
    if (!yearsMap.has(entry.period.year)) {
      yearsMap.set(entry.period.year, []);
    }
    yearsMap.get(entry.period.year).push(entry);
  }

  const years = [...yearsMap.keys()].sort((a, b) => b - a);
  const allYears = year === 'all';
  const selectedYear = Number.isFinite(Number(year))
    ? Number(year)
    : years[0] || new Date().getFullYear();

  const yearStats = years.map(y => {
    const entries = yearsMap.get(y) || [];
    const present = [...new Set(entries.map(entry => entry.period.month))].sort((a, b) => a - b);
    const missing = [...monthSet].filter(m => !present.includes(m));
    const grossValues = entries.map(entry => entry.summary.grossSalary).filter(Number.isFinite);
    const netValues = entries.map(entry => entry.summary.netSalary).filter(Number.isFinite);
    const taxValues = entries.map(entry => entry.summary.tax).filter(Number.isFinite);
    const niValues = entries.map(entry => entry.summary.nationalInsurance).filter(Number.isFinite);
    const hiValues = entries.map(entry => entry.summary.healthInsurance).filter(Number.isFinite);
    const credits = entries.map(entry => entry.summary.taxCreditPoints).filter(Number.isFinite);

    return {
      year: y,
      monthsPresent: present,
      missingMonths: missing,
      monthsMissingCount: missing.length,
      coveragePercent: Math.round((present.length / 12) * 100),
      grossAverage: computeAverage(grossValues),
      netAverage: computeAverage(netValues),
      grossTotal: computeSum(grossValues),
      netTotal: computeSum(netValues),
      taxPaidTotal: computeSum(taxValues),
      nationalInsuranceTotal: computeSum(niValues),
      healthInsuranceTotal: computeSum(hiValues),
      taxCreditPointsAverage: computeAverage(credits),
    };
  });

  const selectedYearEntries = (allYears ? dedupedEntries : (yearsMap.get(selectedYear) || []))
    .slice()
    .sort((a, b) => {
      if (a.period.year !== b.period.year) return b.period.year - a.period.year;
      if (a.period.month !== b.period.month) return b.period.month - a.period.month;
      const aTs = new Date(a.doc.uploadedAt || 0).getTime();
      const bTs = new Date(b.doc.uploadedAt || 0).getTime();
      return bTs - aTs;
    })
    .map((entry, index) => {
      const missingCritical = computeMissingCritical(entry);
      return {
        id: entry.doc._id?.toString?.() || entry.doc._id,
        periodMonth: `${entry.period.year}-${String(entry.period.month).padStart(2, '0')}`,
        periodYear: entry.period.year,
        periodMonthNumber: entry.period.month,
        grossSalary: entry.summary.grossSalary,
        netSalary: entry.summary.netSalary,
        tax: entry.summary.tax,
        nationalInsurance: entry.summary.nationalInsurance,
        healthInsurance: entry.summary.healthInsurance,
        pensionEmployee: entry.summary.pensionEmployee,
        pensionEmployer: entry.summary.pensionEmployer,
        pensionSeverance: entry.summary.pensionSeverance,
        uploadedAt: entry.doc.uploadedAt || null,
        isLatest: index === 0,
        needsReview: entry.doc.status === 'needs_review' || missingCritical.length > 0,
        missingCritical,
      };
    });

  const incompleteItems = resolved
    .filter(entry => entry.period.incompletePeriod)
    .map(entry => {
      const missingCritical = [...computeMissingCritical(entry), 'period'];
      const uploadedAt = entry.doc.uploadedAt ? new Date(entry.doc.uploadedAt) : null;
      const uploadYear = uploadedAt && !Number.isNaN(uploadedAt.getTime())
        ? uploadedAt.getFullYear()
        : null;
      const uploadMonth = uploadedAt && !Number.isNaN(uploadedAt.getTime())
        ? uploadedAt.getMonth() + 1
        : null;
      return {
        id: entry.doc._id?.toString?.() || entry.doc._id,
        periodMonth: uploadYear && uploadMonth
          ? `${uploadYear}-${String(uploadMonth).padStart(2, '0')}`
          : 'unknown',
        periodYear: uploadYear,
        periodMonthNumber: uploadMonth,
        grossSalary: entry.summary.grossSalary,
        netSalary: entry.summary.netSalary,
        tax: entry.summary.tax,
        nationalInsurance: entry.summary.nationalInsurance,
        healthInsurance: entry.summary.healthInsurance,
        pensionEmployee: entry.summary.pensionEmployee,
        pensionEmployer: entry.summary.pensionEmployer,
        pensionSeverance: entry.summary.pensionSeverance,
        uploadedAt: entry.doc.uploadedAt || null,
        isLatest: false,
        needsReview: true,
        missingCritical,
        incompletePeriod: true,
        originalName: entry.doc.originalName || null,
      };
    })
    .filter(item => allYears || !Number.isFinite(selectedYear) || item.periodYear === selectedYear);

  const mergedItems = [...selectedYearEntries, ...incompleteItems]
    .sort((a, b) => {
      const aTs = new Date(a.uploadedAt || 0).getTime();
      const bTs = new Date(b.uploadedAt || 0).getTime();
      return bTs - aTs;
    })
    .map((item, index) => ({ ...item, isLatest: index === 0 }));

  const selectedYearStats = yearStats.find(stat => stat.year === selectedYear) || {
    year: selectedYear,
    monthsPresent: [],
    missingMonths: Array.from({ length: 12 }, (_, i) => i + 1),
    monthsMissingCount: 12,
    coveragePercent: 0,
    grossAverage: null,
    netAverage: null,
    grossTotal: 0,
    netTotal: 0,
    taxPaidTotal: 0,
    nationalInsuranceTotal: 0,
    healthInsuranceTotal: 0,
    taxCreditPointsAverage: null,
  };

  const taxAdjustment = calculateAnnualTaxAdjustment({
    year: selectedYear,
    grossTotal: selectedYearStats.grossTotal,
    taxPaidTotal: selectedYearStats.taxPaidTotal,
    monthsPresent: selectedYearStats.monthsPresent,
    missingMonths: selectedYearStats.missingMonths,
    taxCreditPointsAverage: selectedYearStats.taxCreditPointsAverage,
  });

  const missingMonthsByYear = yearStats.map(stat => ({
    year: stat.year,
    missingMonths: stat.missingMonths,
  }));

  const dataQualityWarnings = [];
  if (incompletePeriods.length) {
    dataQualityWarnings.push(`נמצאו ${incompletePeriods.length} תלושים ללא תקופה מזוהה.`);
  }
  if (selectedYearStats.missingMonths.length) {
    dataQualityWarnings.push(
      `בשנת ${selectedYear} חסרים ${selectedYearStats.missingMonths.length} תלושים.`,
    );
  }

  return {
    years: yearStats,
    selectedYear,
    selectedYearStats,
    items: mergedItems,
    missingMonthsByYear,
    incompletePeriods,
    taxAdjustment,
    dataQualityWarnings,
  };
}

module.exports = {
  buildPayslipHistoryIntelligence,
  resolvePayslipPeriod,
};
