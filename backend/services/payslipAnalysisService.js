const { ValidationError } = require('../utils/appErrors');
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

const sanitizeQualityField = value => {
  if (!isPlainObject(value)) {
    return undefined;
  }

  const confidence = toFiniteNumber(value.confidence);
  const source = toNonEmptyString(value.source);
  const evidence = toNonEmptyString(value.evidence);
  const rejected = Boolean(value.rejected);
  const abstained = Boolean(value.abstained);

  if (
    confidence === null &&
    source === undefined &&
    evidence === undefined &&
    !rejected &&
    !abstained
  ) {
    return undefined;
  }

  return {
    ...(confidence !== null && { confidence }),
    ...(source && { source }),
    ...(evidence && { evidence }),
    ...(rejected && { rejected }),
    ...(abstained && { abstained }),
  };
};

const sanitizeQualityPayload = quality => {
  if (!isPlainObject(quality)) {
    return {
      confidence: null,
      resolution_score: null,
      warnings: [],
      warning_categories: [],
      fields: {},
    };
  }

  const fields = isPlainObject(quality.fields)
    ? Object.entries(quality.fields).reduce((acc, [key, value]) => {
      const sanitized = sanitizeQualityField(value);
      if (sanitized) {
        acc[key] = sanitized;
      }
      return acc;
    }, {})
    : {};

  return {
    confidence: toFiniteNumber(quality.confidence),
    resolution_score: toFiniteNumber(quality.resolution_score),
    warnings: Array.isArray(quality.warnings)
      ? quality.warnings.filter(item => typeof item === 'string' && item.trim())
      : [],
    warning_categories: Array.isArray(quality.warning_categories)
      ? quality.warning_categories.filter(item => typeof item === 'string' && item.trim())
      : [],
    fields,
  };
};

const hasRenderableSignals = analysis => {
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
  const components = Array.isArray(salary.components) ? salary.components : [];

  return Boolean(
    toNonEmptyString(period.month) ||
      components.length > 0 ||
      toFiniteNumber(salary.gross_total) !== null ||
      toFiniteNumber(salary.net_payable) !== null ||
      toFiniteNumber(mandatory.total) !== null ||
      toFiniteNumber(pension.employee) !== null ||
      toFiniteNumber(pension.employer) !== null ||
      toFiniteNumber(pension.severance) !== null ||
      toFiniteNumber(studyFund.employee) !== null ||
      toFiniteNumber(studyFund.employer) !== null ||
      toNonEmptyString(parties.employee_name) ||
      toNonEmptyString(parties.employee_id) ||
      toNonEmptyString(parties.employer_name) ||
      toNonEmptyString(summary.date) ||
      toFiniteNumber(employment.job_percent) !== null
  );
};

const sanitizeSalaryComponents = salary => {
  if (!Array.isArray(salary?.components)) {
    return [];
  }

  return salary.components
    .filter(component => isPlainObject(component))
    .map(component => ({
      type: toNonEmptyString(component.type),
      amount: toFiniteNumber(component.amount),
    }))
    .filter(component => component.type && component.amount !== null);
};

const sanitizeAnalysisCore = rawAnalysis => {
  if (!isPlainObject(rawAnalysis)) {
    return null;
  }

  const salary = isPlainObject(rawAnalysis.salary) ? rawAnalysis.salary : {};
  const deductions = isPlainObject(rawAnalysis.deductions) ? rawAnalysis.deductions : {};
  const mandatory = isPlainObject(deductions.mandatory) ? deductions.mandatory : {};
  const contributions = isPlainObject(rawAnalysis.contributions) ? rawAnalysis.contributions : {};
  const pension = isPlainObject(contributions.pension) ? contributions.pension : {};
  const studyFund = isPlainObject(contributions.study_fund) ? contributions.study_fund : {};
  const parties = isPlainObject(rawAnalysis.parties) ? rawAnalysis.parties : {};
  const summary = isPlainObject(rawAnalysis.summary) ? rawAnalysis.summary : {};
  const employment = isPlainObject(rawAnalysis.employment) ? rawAnalysis.employment : {};
  const period = isPlainObject(rawAnalysis.period) ? rawAnalysis.period : {};
  const tax = isPlainObject(rawAnalysis.tax) ? rawAnalysis.tax : {};
  const nationalInsurance = isPlainObject(rawAnalysis.national_insurance)
    ? rawAnalysis.national_insurance
    : {};

  const normalized = {
    schema_version: toNonEmptyString(rawAnalysis.schema_version) || 'unknown',
    period: {
      ...(toNonEmptyString(period.month) && { month: toNonEmptyString(period.month) }),
    },
    salary: {
      gross_total: toFiniteNumber(salary.gross_total),
      net_payable: toFiniteNumber(salary.net_payable),
      components: sanitizeSalaryComponents(salary),
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
        base: toFiniteNumber(pension.base) ?? toFiniteNumber(pension.base_salary_for_pension),
        employee: toFiniteNumber(pension.employee),
        employer: toFiniteNumber(pension.employer),
        severance: toFiniteNumber(pension.severance),
      },
      study_fund: {
        base:
          toFiniteNumber(studyFund.base) ??
          toFiniteNumber(studyFund.base_salary_for_study_fund),
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
    quality: sanitizeQualityPayload(rawAnalysis.quality),
  };

  return hasRenderableSignals(normalized) ? normalized : null;
};

const normalizePayslipAnalysis = rawAnalysis => {
  const normalized = sanitizeAnalysisCore(rawAnalysis);

  if (!normalized) {
    throw new ValidationError('תוצאת OCR לא תקינה', [
      {
        field: 'analysisData',
        message: 'לא זוהו נתוני תלוש מספקים לשמירה',
        value: null,
      },
    ]);
  }

  return normalized;
};

const getValidatedPayslipAnalysis = rawAnalysis => sanitizeAnalysisCore(rawAnalysis);

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

  return periodMonthToDate(month) || undefined;
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
  pension_severance: 'פיצויים',
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
    items.push({ label: DEDUCTION_LABELS.income_tax, amount: mandatory.income_tax });
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

  if (analysis.contributions.pension.severance !== null) {
    items.push({
      label: DEDUCTION_LABELS.pension_severance,
      amount: analysis.contributions.pension.severance,
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

const buildCanonicalPayslip = document => {
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
  const periodDate = periodMonthToDate(periodMonth);

  return {
    id: raw._id?.toString?.() || raw._id,
    metadata,
    analysis,
    periodMonth,
    periodLabel: formatPeriodLabel(periodMonth),
    periodDate,
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
    contributions: analysis.contributions,
    tax: analysis.tax,
    nationalInsurance: analysis.national_insurance,
    quality: analysis.quality,
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

const buildCanonicalPayslipHistory = documents => {
  const items = sortPayslipDetails(documents.map(buildCanonicalPayslip).filter(Boolean));

  return {
    stats: computePayslipStats(items),
    items,
  };
};

module.exports = {
  buildCanonicalPayslip,
  buildCanonicalPayslipHistory,
  getValidatedPayslipAnalysis,
  normalizePayslipAnalysis,
};
