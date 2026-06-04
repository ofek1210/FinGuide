const Document = require('../models/Document');
const { buildPayslipHistoryIntelligence } = require('./payslipHistoryAggregationService');
const { resolvePayslipPeriod, toFiniteNumber } = require('../utils/payslipPeriod');

const HEBREW_MONTHS = Object.freeze([
  '',
  'ינואר',
  'פברואר',
  'מרץ',
  'אפריל',
  'מאי',
  'יוני',
  'יולי',
  'אוגוסט',
  'ספטמבר',
  'אוקטובר',
  'נובמבר',
  'דצמבר',
]);

const UNUSUAL_TAX_MULTIPLIER = 1.5;
const MIN_TAX_MONTHS_FOR_AVERAGE = 2;

const normalizeEmployerName = value => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim().replace(/\s+/g, ' ');
  return trimmed.length >= 2 ? trimmed : null;
};

const getEmployerName = doc => {
  const parties = doc?.analysisData?.parties;
  if (typeof parties === 'string') {
    return normalizeEmployerName(parties);
  }
  if (parties && typeof parties === 'object') {
    const direct = parties.employer_name ?? parties.employerName;
    if (typeof direct === 'string') {
      return normalizeEmployerName(direct);
    }
    if (direct && typeof direct === 'object' && direct.value) {
      return normalizeEmployerName(String(direct.value));
    }
  }
  return normalizeEmployerName(doc?.analysisData?.summary?.employerName);
};

const isPayslipDocument = doc => {
  if (doc?.status !== 'completed' || !doc.analysisData) {
    return false;
  }

  const category = doc.metadata?.category;
  if (category === 'tax_report' || category === 'form_106' || category === 'invoice') {
    return false;
  }
  if (category === 'payslip') {
    return true;
  }

  return Boolean(
    doc.analysisData?.salary?.gross_total
    || doc.analysisData?.summary?.grossSalary
    || doc.analysisData?.period?.month,
  );
};

const isForm106Document = (doc, year) => {
  if (doc?.status !== 'completed') {
    return false;
  }

  const category = doc.metadata?.category;
  const name = (doc.originalName || '').toLowerCase();
  const matchesType =
    category === 'form_106'
    || category === 'tax_report'
    || name.includes('106')
    || name.includes('טופס');

  if (!matchesType) {
    return false;
  }

  const metadataYear = toFiniteNumber(doc.metadata?.periodYear);
  if (metadataYear === year) {
    return true;
  }

  const period = resolvePayslipPeriod(doc);
  return period.year === year && !period.incompletePeriod;
};

const formatMonthListHebrew = months =>
  months
    .slice()
    .sort((a, b) => a - b)
    .map(month => HEBREW_MONTHS[month] || String(month))
    .join(' ו');

const buildYearEntries = (documents, year) => {
  const payslips = documents.filter(isPayslipDocument);
  const history = buildPayslipHistoryIntelligence(payslips, { year });
  const entryMap = new Map();

  for (const doc of payslips) {
    const period = resolvePayslipPeriod(doc);
    if (period.incompletePeriod || period.year !== year) {
      continue;
    }

    const key = `${year}-${String(period.month).padStart(2, '0')}`;
    const existing = entryMap.get(key);
    if (!existing) {
      entryMap.set(key, { doc, period });
      continue;
    }

    const existingTime = new Date(
      existing.doc.processedAt || existing.doc.uploadedAt || 0,
    ).getTime();
    const nextTime = new Date(doc.processedAt || doc.uploadedAt || 0).getTime();
    if (nextTime >= existingTime) {
      entryMap.set(key, { doc, period });
    }
  }

  return {
    history,
    entries: [...entryMap.values()].sort((a, b) => a.period.month - b.period.month),
  };
};

const enrichEntrySummary = doc => {
  const item = buildPayslipHistoryIntelligence([doc], {
    year: resolvePayslipPeriod(doc).year,
  }).items[0];

  return {
    grossSalary: item?.grossSalary ?? null,
    netSalary: item?.netSalary ?? null,
    tax: item?.tax ?? null,
    pensionEmployee: item?.pensionEmployee ?? null,
    pensionEmployer: item?.pensionEmployer ?? null,
  };
};

const detectMissingPayslips = (year, missingMonths) => {
  if (!missingMonths.length) {
    return null;
  }

  return {
    type: 'missing_payslips',
    severity: 'medium',
    title: 'חסרים תלושי שכר',
    message: `חסרים תלושים עבור ${formatMonthListHebrew(missingMonths)} ${year}`,
    months: missingMonths,
  };
};

const detectMultipleEmployers = (year, employers) => {
  if (employers.length < 2) {
    return null;
  }

  return {
    type: 'multiple_employers',
    severity: 'medium',
    title: 'יותר ממעסיק אחד',
    message: `זוהו ${employers.length} מעסיקים שונים בשנת ${year}: ${employers.join(', ')}`,
    employers,
  };
};

const detectEmployerChange = (year, employers) => {
  if (employers.length < 2) {
    return null;
  }

  return {
    type: 'employer_change',
    severity: 'low',
    title: 'שינוי מעסיק במהלך השנה',
    message: `שם המעסיק השתנה במהלך ${year}. מעסיקים: ${employers.join(' → ')}`,
    employers,
  };
};

const detectUnusualIncomeTax = (year, entries) => {
  const taxedMonths = entries
    .map(entry => ({
      month: entry.period.month,
      tax: enrichEntrySummary(entry.doc).tax,
    }))
    .filter(item => Number.isFinite(item.tax) && item.tax > 0);

  if (taxedMonths.length < MIN_TAX_MONTHS_FOR_AVERAGE) {
    return null;
  }

  const average = taxedMonths.reduce((sum, item) => sum + item.tax, 0) / taxedMonths.length;
  const threshold = average * UNUSUAL_TAX_MULTIPLIER;
  const unusualMonths = taxedMonths
    .filter(item => item.tax >= threshold)
    .map(item => item.month);

  if (!unusualMonths.length) {
    return null;
  }

  return {
    type: 'unusual_income_tax',
    severity: 'medium',
    title: 'מס הכנסה חריג בחודשים מסוימים',
    message: `מס הכנסה גבוה מהממוצע החודשי בחודשים: ${formatMonthListHebrew(unusualMonths)} (${year})`,
    months: unusualMonths,
    averageTax: Math.round(average),
    threshold: Math.round(threshold),
  };
};

const detectMissingPensionContributions = (year, entries) => {
  const months = [];

  for (const entry of entries) {
    const summary = enrichEntrySummary(entry.doc);
    const hasGross = Number.isFinite(summary.grossSalary) && summary.grossSalary > 0;
    if (!hasGross) {
      continue;
    }

    const employeeMissing = !Number.isFinite(summary.pensionEmployee) || summary.pensionEmployee <= 0;
    const employerMissing = !Number.isFinite(summary.pensionEmployer) || summary.pensionEmployer <= 0;

    if (employeeMissing || employerMissing) {
      months.push(entry.period.month);
    }
  }

  if (!months.length) {
    return null;
  }

  return {
    type: 'missing_pension_contributions',
    severity: 'high',
    title: 'חסרות הפקדות פנסיה',
    message: `לא זוהו הפקדות פנסיה (עובד/מעסיק) בחודשים: ${formatMonthListHebrew(months)} ${year}`,
    months,
  };
};

const detectMissingForm106 = (year, documents, payslipCount) => {
  if (payslipCount === 0) {
    return null;
  }

  const hasForm106 = documents.some(doc => isForm106Document(doc, year));
  if (hasForm106) {
    return null;
  }

  return {
    type: 'missing_form_106',
    severity: 'medium',
    title: 'חסר טופס 106',
    message: `קיימים תלושי שכר לשנת ${year}, אך לא נמצא טופס 106 עבור אותה שנה`,
    year,
  };
};

const buildTaxAssistantSummary = async (userId, yearInput) => {
  const year = Number(yearInput) || new Date().getFullYear();
  const documents = await Document.find({ user: userId }).sort('-uploadedAt').lean();

  const { history, entries } = buildYearEntries(documents, year);
  const yearStats = history.selectedYearStats;
  const missingMonths = yearStats.missingMonths || [];

  const employersOrdered = [];
  const employersSet = new Set();
  for (const entry of entries) {
    const name = getEmployerName(entry.doc);
    if (!name || employersSet.has(name)) {
      continue;
    }
    employersSet.add(name);
    employersOrdered.push(name);
  }

  const issues = [
    detectMissingPayslips(year, missingMonths),
    detectMultipleEmployers(year, employersOrdered),
    detectEmployerChange(year, employersOrdered),
    detectUnusualIncomeTax(year, entries),
    detectMissingPensionContributions(year, entries),
    detectMissingForm106(year, documents, entries.length),
  ].filter(Boolean);

  return {
    year,
    issues,
    summary: {
      totalSalaryDocuments: entries.length,
      totalGrossIncome: yearStats.grossTotal || 0,
      totalNetIncome: yearStats.netTotal || 0,
      totalIncomeTax: yearStats.taxPaidTotal || 0,
      employers: employersOrdered,
      monthsPresent: yearStats.monthsPresent || [],
      missingMonths,
    },
    disclaimer:
      'המידע המוצג הוא הערכה בלבד ואינו מהווה ייעוץ מס מקצועי.',
  };
};

module.exports = {
  buildTaxAssistantSummary,
  buildYearEntries,
  enrichEntrySummary,
  getEmployerName,
  isPayslipDocument,
  isForm106Document,
  HEBREW_MONTHS,
};
