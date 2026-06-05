const { calculateAnnualTaxAdjustment } = require('./taxAdjustmentRulesService');
const {
  resolvePayslipPeriod,
  selectLatestDoc,
  toFiniteNumber,
} = require('../utils/payslipPeriod');

const monthSet = new Set(Array.from({ length: 12 }, (_, i) => i + 1));

/**
 * Returns true if gross passes a sanity check: it must be >= every individual
 * salary component (a component cannot exceed the total it belongs to).
 */
function isGrossPlausible(gross, salary) {
  if (!Number.isFinite(gross) || gross <= 0) return false;
  const components = salary?.components;
  if (!Array.isArray(components) || !components.length) return true;
  const maxComponent = components.reduce((max, c) => {
    const amount = toFiniteNumber(c.amount) ?? 0;
    return Math.max(max, amount);
  }, 0);
  return gross >= maxComponent;
}

function enrichSummary(document) {
  const summary = document?.analysisData?.summary || {};
  const salary = document?.analysisData?.salary || {};
  const deductions = document?.analysisData?.deductions?.mandatory || {};
  const contributions = document?.analysisData?.contributions || {};
  const tax = document?.analysisData?.tax || {};

  // Validate extracted gross — if it's smaller than a single component, it's wrong.
  // Fallback priority:
  //   1. summary.grossSalary (pre-calculated, most trusted)
  //   2. salary.gross_total (if plausible)
  //   3. contributions.pension.base_salary_for_pension (often equals displayed gross on payslip)
  //   4. tax.gross_for_income_tax (taxable gross)
  const rawGross = toFiniteNumber(summary.grossSalary) ?? toFiniteNumber(salary.gross_total);
  const grossSalary = isGrossPlausible(rawGross, salary)
    ? rawGross
    : (toFiniteNumber(contributions?.pension?.base_salary_for_pension)
        ?? toFiniteNumber(tax.gross_for_income_tax)
        ?? rawGross);

  // Validate net plausibility: net must be at least 30% of gross.
  // If it isn't, the OCR likely picked a daily/hourly rate instead of the bank transfer.
  // Fallback: gross - all stored deductions (mandatory + pension employee).
  const rawNet = toFiniteNumber(summary.netSalary) ?? toFiniteNumber(salary.net_payable);
  const grossForNetCheck = grossSalary || toFiniteNumber(tax.gross_for_income_tax);
  const netIsPlausible = Number.isFinite(rawNet) && Number.isFinite(grossForNetCheck)
    && grossForNetCheck > 0
    && (rawNet / grossForNetCheck) >= 0.3;
  const derivedNet = (() => {
    if (!Number.isFinite(grossForNetCheck)) return null;
    const mandatoryTotal = toFiniteNumber(deductions.total);
    const pensionEmployee =
      toFiniteNumber(document?.analysisData?.contributions?.pension?.employee_amount) ?? 0;
    if (!Number.isFinite(mandatoryTotal)) return null;
    return Math.round((grossForNetCheck - mandatoryTotal - pensionEmployee) * 100) / 100;
  })();
  const netSalary = netIsPlausible ? rawNet : (derivedNet ?? rawNet);

  return {
    grossSalary,
    netSalary,
    tax: toFiniteNumber(summary.tax) ?? toFiniteNumber(deductions.income_tax),
    nationalInsurance:
      toFiniteNumber(summary.nationalInsurance) ?? toFiniteNumber(deductions.national_insurance),
    healthInsurance:
      toFiniteNumber(summary.healthInsurance) ?? toFiniteNumber(deductions.health_insurance),
    pensionEmployee:
      toFiniteNumber(summary.pensionEmployee)
      ?? toFiniteNumber(document?.analysisData?.contributions?.pension?.employee_amount),
    pensionEmployer:
      toFiniteNumber(summary.pensionEmployer)
      ?? toFiniteNumber(document?.analysisData?.contributions?.pension?.employer_amount),
    pensionSeverance:
      toFiniteNumber(summary.pensionSeverance)
      ?? toFiniteNumber(document?.analysisData?.contributions?.pension?.severance_amount),
    taxCreditPoints: toFiniteNumber(summary.taxCreditPoints),
  };
}

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

function buildPayslipHistoryIntelligence(documents, { year } = {}) {
  const completed = (documents || []).filter(
    doc => doc?.status === 'completed' && doc?.analysisData && typeof doc.analysisData === 'object',
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

  const selectedYearEntries = (yearsMap.get(selectedYear) || [])
    .sort((a, b) => {
      if (a.period.year !== b.period.year) return b.period.year - a.period.year;
      if (a.period.month !== b.period.month) return b.period.month - a.period.month;
      const aTs = new Date(a.doc.uploadedAt || 0).getTime();
      const bTs = new Date(b.doc.uploadedAt || 0).getTime();
      return bTs - aTs;
    })
    .map((entry, index) => ({
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
    }));

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
    items: selectedYearEntries,
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
