const { calculateAnnualTaxAdjustment } = require('./taxAdjustmentRulesService');

const monthSet = new Set(Array.from({ length: 12 }, (_, i) => i + 1));

function toFiniteNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function parseYearMonth(value) {
  if (!value || typeof value !== 'string') return null;
  const m = value.match(/^(\d{4})-(\d{2})$/);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (year < 2000 || year > 2100 || month < 1 || month > 12) return null;
  return { year, month };
}

function parseDateLike(value) {
  if (!value || typeof value !== 'string') return null;
  const yyyyMmDd = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (yyyyMmDd) {
    return { year: Number(yyyyMmDd[1]), month: Number(yyyyMmDd[2]) };
  }
  const ddMmYyyy = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (ddMmYyyy) {
    const year = Number(ddMmYyyy[3].length === 2 ? `20${ddMmYyyy[3]}` : ddMmYyyy[3]);
    const month = Number(ddMmYyyy[2]);
    if (year < 2000 || year > 2100 || month < 1 || month > 12) return null;
    return { year, month };
  }
  const mmYyyy = value.match(/^(\d{1,2})\/(\d{4})$/);
  if (mmYyyy) {
    const year = Number(mmYyyy[2]);
    const month = Number(mmYyyy[1]);
    if (year < 2000 || year > 2100 || month < 1 || month > 12) return null;
    return { year, month };
  }
  return null;
}

function resolvePayslipPeriod(document) {
  const metadataYear = toFiniteNumber(document?.metadata?.periodYear);
  const metadataMonth = toFiniteNumber(document?.metadata?.periodMonth);
  if (metadataYear && metadataMonth && metadataMonth >= 1 && metadataMonth <= 12) {
    return {
      year: metadataYear,
      month: metadataMonth,
      source: 'metadata',
      incompletePeriod: false,
    };
  }

  const analysisPeriod = parseYearMonth(document?.analysisData?.period?.month);
  if (analysisPeriod) {
    return {
      ...analysisPeriod,
      source: 'analysis.period.month',
      incompletePeriod: false,
    };
  }

  const summaryDate = parseDateLike(document?.analysisData?.summary?.date);
  if (summaryDate) {
    return {
      ...summaryDate,
      source: 'summary.date',
      incompletePeriod: false,
    };
  }

  return {
    year: null,
    month: null,
    source: null,
    incompletePeriod: true,
  };
}

function selectLatestDoc(existing, nextDoc) {
  const existingTime = new Date(
    existing.processedAt || existing.uploadedAt || existing.updatedAt || existing.createdAt || 0,
  ).getTime();
  const nextTime = new Date(
    nextDoc.processedAt || nextDoc.uploadedAt || nextDoc.updatedAt || nextDoc.createdAt || 0,
  ).getTime();
  return nextTime >= existingTime ? nextDoc : existing;
}

function enrichSummary(document) {
  const summary = document?.analysisData?.summary || {};
  const salary = document?.analysisData?.salary || {};
  const deductions = document?.analysisData?.deductions?.mandatory || {};
  return {
    grossSalary: toFiniteNumber(summary.grossSalary) ?? toFiniteNumber(salary.gross_total),
    netSalary: toFiniteNumber(summary.netSalary) ?? toFiniteNumber(salary.net_payable),
    tax: toFiniteNumber(summary.tax) ?? toFiniteNumber(deductions.income_tax),
    nationalInsurance:
      toFiniteNumber(summary.nationalInsurance) ?? toFiniteNumber(deductions.national_insurance),
    healthInsurance:
      toFiniteNumber(summary.healthInsurance) ?? toFiniteNumber(deductions.health_insurance),
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
    dataQualityWarnings.push(`Found ${incompletePeriods.length} payslips with unresolved period.`);
  }
  if (selectedYearStats.missingMonths.length) {
    dataQualityWarnings.push(
      `Year ${selectedYear} is missing ${selectedYearStats.missingMonths.length} month(s).`,
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
