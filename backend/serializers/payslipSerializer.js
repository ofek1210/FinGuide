const { getDocumentMetadata } = require('../utils/documentMetadata');

const PERIOD_LOCALE = 'he-IL';
const FALLBACK_PERIOD_LABEL = 'תלוש משכורת';

const isPlainObject = value =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const toFiniteNumber = value =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const toNonEmptyString = value =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;

const toIsoDate = value => {
  if (!value) return undefined;

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return date.toISOString().slice(0, 10);
};

const toDocumentObject = document =>
  document && typeof document.toObject === 'function' ? document.toObject() : document;

const getValidatedPayslipAnalysis = rawAnalysis => {
  if (!isPlainObject(rawAnalysis)) {
    return null;
  }

  const analysis = rawAnalysis;
  const salary = isPlainObject(analysis.salary) ? analysis.salary : {};
  const deductions = isPlainObject(analysis.deductions) ? analysis.deductions : {};
  const mandatory = isPlainObject(deductions.mandatory) ? deductions.mandatory : {};
  const contributions = isPlainObject(analysis.contributions) ? analysis.contributions : {};
  const pension = isPlainObject(contributions.pension) ? contributions.pension : {};
  const studyFund = isPlainObject(contributions.study_fund) ? contributions.study_fund : {};
  const parties = isPlainObject(analysis.parties) ? analysis.parties : {};
  const summary = isPlainObject(analysis.summary) ? analysis.summary : {};
  const employment = isPlainObject(analysis.employment) ? analysis.employment : {};
  const period = isPlainObject(analysis.period) ? analysis.period : {};
  const tax = isPlainObject(analysis.tax) ? analysis.tax : {};
  const nationalInsurance = isPlainObject(analysis.national_insurance)
    ? analysis.national_insurance
    : {};

  const components = Array.isArray(salary.components)
    ? salary.components.filter(component => {
      if (!isPlainObject(component)) {
        return false;
      }

      return (
        toNonEmptyString(component.type) &&
        toFiniteNumber(component.amount) !== null
      );
    })
    : [];

  const hasRenderableSignals = Boolean(
    toNonEmptyString(period.month) ||
      components.length > 0 ||
      toFiniteNumber(salary.gross_total) !== null ||
      toFiniteNumber(salary.net_payable) !== null ||
      toFiniteNumber(mandatory.total) !== null ||
      toNonEmptyString(parties.employee_name) ||
      toNonEmptyString(parties.employee_id) ||
      toNonEmptyString(parties.employer_name) ||
      toNonEmptyString(summary.date) ||
      toFiniteNumber(employment.job_percent) !== null
  );

  if (!hasRenderableSignals) {
    return null;
  }

  return {
    period,
    salary: {
      gross_total: toFiniteNumber(salary.gross_total),
      net_payable: toFiniteNumber(salary.net_payable),
      components: components.map(component => ({
        type: toNonEmptyString(component.type),
        amount: toFiniteNumber(component.amount),
      })),
    },
    deductions: {
      mandatory: {
        total: toFiniteNumber(mandatory.total),
        income_tax: toFiniteNumber(mandatory.income_tax),
        national_insurance: toFiniteNumber(mandatory.national_insurance),
        health_insurance: toFiniteNumber(mandatory.health_insurance),
      },
    },
    contributions: {
      pension: {
        employee: toFiniteNumber(pension.employee),
        employer: toFiniteNumber(pension.employer),
      },
      study_fund: {
        employee: toFiniteNumber(studyFund.employee),
        employer: toFiniteNumber(studyFund.employer),
      },
    },
    parties: {
      employer_name: toNonEmptyString(parties.employer_name),
      employee_name: toNonEmptyString(parties.employee_name),
      employee_id: toNonEmptyString(parties.employee_id),
    },
    employment: {
      job_percent: toFiniteNumber(employment.job_percent),
    },
    summary: {
      date: toNonEmptyString(summary.date),
      jobPercentage: toFiniteNumber(summary.jobPercentage),
      workingDays: toFiniteNumber(summary.workingDays),
      workingHours: toFiniteNumber(summary.workingHours),
      vacationDays: toFiniteNumber(summary.vacationDays),
      sickDays: toFiniteNumber(summary.sickDays),
    },
    tax: {
      gross_for_income_tax: toFiniteNumber(tax.gross_for_income_tax),
    },
    national_insurance: {
      gross_for_national_insurance: toFiniteNumber(
        nationalInsurance.gross_for_national_insurance
      ),
    },
  };
};

const normalizePeriodMonth = (analysis, metadata) => {
  const fromAnalysis = toNonEmptyString(analysis.period.month);
  if (fromAnalysis && /^\d{4}-\d{2}$/.test(fromAnalysis)) {
    return fromAnalysis;
  }

  if (Number.isInteger(metadata.periodYear) && Number.isInteger(metadata.periodMonth)) {
    return `${metadata.periodYear}-${String(metadata.periodMonth).padStart(2, '0')}`;
  }

  return undefined;
};

const formatPeriodLabel = month => {
  if (!month || typeof month !== 'string') {
    return FALLBACK_PERIOD_LABEL;
  }

  const [year, monthNumber] = month.split('-').map(Number);
  if (!Number.isFinite(year) || !Number.isFinite(monthNumber) || monthNumber < 1 || monthNumber > 12) {
    return FALLBACK_PERIOD_LABEL;
  }

  const date = new Date(year, monthNumber - 1, 1);
  if (Number.isNaN(date.getTime())) {
    return FALLBACK_PERIOD_LABEL;
  }

  return new Intl.DateTimeFormat(PERIOD_LOCALE, {
    month: 'long',
    year: 'numeric',
  }).format(date);
};

const periodMonthToDate = month => {
  if (!month || typeof month !== 'string') {
    return '';
  }

  const [year, monthNumber] = month.split('-').map(Number);
  if (!Number.isFinite(year) || !Number.isFinite(monthNumber) || monthNumber < 1 || monthNumber > 12) {
    return '';
  }

  return `${year}-${String(monthNumber).padStart(2, '0')}-01`;
};

const normalizePaymentDate = (month, summaryDate, metadata) => {
  const fromSummary = toNonEmptyString(summaryDate);
  if (fromSummary && /^\d{4}-\d{2}-\d{2}$/.test(fromSummary)) {
    return fromSummary;
  }

  if (fromSummary && /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(fromSummary)) {
    const [day, monthNumber, year] = fromSummary.split('/');
    const normalizedYear = year.length === 2 ? `20${year}` : year;
    return `${normalizedYear}-${monthNumber.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  const fromMetadata = toIsoDate(metadata.documentDate);
  if (fromMetadata) {
    return fromMetadata;
  }

  const fromPeriod = periodMonthToDate(month);
  return fromPeriod || undefined;
};

const EARNINGS_LABELS = {
  base_salary: 'משכורת בסיס',
  global_overtime: 'שעות נוספות',
  travel_expenses: 'נסיעות',
};

const DEDUCTION_LABELS = {
  income_tax: 'מס הכנסה',
  national_insurance: 'ביטוח לאומי',
  health_insurance: 'ביטוח בריאות',
  pension_employee: 'הפקדה לפנסיה (עובד)',
  pension_employer: 'הפקדה לפנסיה (מעסיק)',
  study_fund_employee: 'קרן השתלמות (עובד)',
  study_fund_employer: 'קרן השתלמות (מעסיק)',
};

const mapEarnings = analysis => {
  if (analysis.salary.components.length > 0) {
    return analysis.salary.components.map(component => ({
      label: EARNINGS_LABELS[component.type] || component.type,
      amount: component.amount,
    }));
  }

  if (analysis.salary.gross_total !== null) {
    return [
      {
        label: 'שכר ברוטו',
        amount: analysis.salary.gross_total,
      },
    ];
  }

  return [];
};

const mapDeductions = analysis => {
  const items = [];
  const mandatory = analysis.deductions.mandatory;

  if (mandatory.income_tax !== null) {
    items.push({
      label: DEDUCTION_LABELS.income_tax,
      amount: mandatory.income_tax,
    });
  }

  if (mandatory.national_insurance !== null) {
    items.push({
      label: DEDUCTION_LABELS.national_insurance,
      amount: mandatory.national_insurance,
    });
  }

  if (mandatory.health_insurance !== null) {
    items.push({
      label: DEDUCTION_LABELS.health_insurance,
      amount: mandatory.health_insurance,
    });
  }

  if (analysis.contributions.pension.employee !== null) {
    items.push({
      label: DEDUCTION_LABELS.pension_employee,
      amount: analysis.contributions.pension.employee,
    });
  }

  if (analysis.contributions.pension.employer !== null) {
    items.push({
      label: DEDUCTION_LABELS.pension_employer,
      amount: analysis.contributions.pension.employer,
    });
  }

  if (analysis.contributions.study_fund.employee !== null) {
    items.push({
      label: DEDUCTION_LABELS.study_fund_employee,
      amount: analysis.contributions.study_fund.employee,
    });
  }

  if (analysis.contributions.study_fund.employer !== null) {
    items.push({
      label: DEDUCTION_LABELS.study_fund_employer,
      amount: analysis.contributions.study_fund.employer,
    });
  }

  return items;
};

const serializePayslipDetail = document => {
  const raw = toDocumentObject(document);
  if (!raw || raw.status !== 'completed') {
    return null;
  }

  const metadata = getDocumentMetadata(raw);
  const analysis = getValidatedPayslipAnalysis(raw.analysisData);
  if (!analysis) {
    return null;
  }

  const periodMonth = normalizePeriodMonth(analysis, metadata);
  const periodLabel = formatPeriodLabel(periodMonth);

  return {
    id: raw._id?.toString?.() || raw._id,
    periodLabel,
    periodDate: periodMonthToDate(periodMonth),
    paymentDate: normalizePaymentDate(periodMonth, analysis.summary.date, metadata),
    employerName: analysis.parties.employer_name,
    employeeName: analysis.parties.employee_name,
    employeeId: analysis.parties.employee_id,
    jobPercent: analysis.employment.job_percent ?? analysis.summary.jobPercentage,
    workingDays: analysis.summary.workingDays,
    workingHours: analysis.summary.workingHours,
    vacationDays: analysis.summary.vacationDays,
    sickDays: analysis.summary.sickDays,
    earnings: mapEarnings(analysis),
    deductions: mapDeductions(analysis),
    grossSalary: analysis.salary.gross_total,
    netSalary: analysis.salary.net_payable,
  };
};

const computePayslipStats = items => {
  if (items.length === 0) {
    return {
      averageNet: 0,
      averageGross: 0,
      totalPayslips: 0,
    };
  }

  const grossValues = items
    .map(item => item.grossSalary)
    .filter(value => typeof value === 'number' && Number.isFinite(value));
  const netValues = items
    .map(item => item.netSalary)
    .filter(value => typeof value === 'number' && Number.isFinite(value));

  return {
    averageNet: netValues.length
      ? netValues.reduce((sum, value) => sum + value, 0) / netValues.length
      : 0,
    averageGross: grossValues.length
      ? grossValues.reduce((sum, value) => sum + value, 0) / grossValues.length
      : 0,
    totalPayslips: items.length,
  };
};

const sortPayslipDetails = details =>
  [...details].sort((a, b) => {
    const periodA = a.periodDate ? new Date(a.periodDate).getTime() : 0;
    const periodB = b.periodDate ? new Date(b.periodDate).getTime() : 0;

    if (periodA !== periodB) {
      return periodB - periodA;
    }

    return 0;
  });

const serializePayslipHistory = documents => {
  const details = sortPayslipDetails(
    documents.map(serializePayslipDetail).filter(Boolean)
  );

  const items = details.map((item, index) => ({
    id: item.id,
    periodLabel: item.periodLabel,
    periodDate: item.periodDate,
    netSalary: item.netSalary,
    grossSalary: item.grossSalary,
    isLatest: index === 0,
    downloadUrl: null,
  }));

  return {
    stats: computePayslipStats(items),
    items,
  };
};

module.exports = {
  getValidatedPayslipAnalysis,
  serializePayslipDetail,
  serializePayslipHistory,
};
