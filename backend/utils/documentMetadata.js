const { ValidationError } = require('./appErrors');

const DOCUMENT_CATEGORIES = Object.freeze([
  'payslip',
  'tax_report',
  'pension_report',
  'invoice',
  'other',
]);

const DEFAULT_DOCUMENT_METADATA = Object.freeze({
  category: 'other',
  source: 'manual_upload',
});

const toTrimmedString = value => {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim();
};

const toOptionalInteger = value => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value === 'number' && Number.isInteger(value)) {
    return value;
  }

  if (typeof value !== 'string') {
    return Number.NaN;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return undefined;
  }

  if (!/^\d+$/.test(trimmed)) {
    return Number.NaN;
  }

  return Number.parseInt(trimmed, 10);
};

const toOptionalDate = value => {
  const trimmed = toTrimmedString(value);

  if (!trimmed) {
    return undefined;
  }

  const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
  const isoDateTimeRegex = /^\d{4}-\d{2}-\d{2}T.+$/;

  if (!isoDateRegex.test(trimmed) && !isoDateTimeRegex.test(trimmed)) {
    return Number.NaN;
  }

  const normalized = isoDateRegex.test(trimmed)
    ? `${trimmed}T00:00:00.000Z`
    : trimmed;

  const parsed = new Date(normalized);

  if (Number.isNaN(parsed.getTime())) {
    return Number.NaN;
  }

  return parsed;
};

const buildValidationError = errors => {
  throw new ValidationError('שגיאות בולידציה', errors);
};

const normalizeDocumentMetadataInput = rawInput => {
  const input = rawInput || {};
  const errors = [];
  const category = toTrimmedString(input.category);
  const periodMonth = toOptionalInteger(input.periodMonth);
  const periodYear = toOptionalInteger(input.periodYear);
  const documentDate = toOptionalDate(input.documentDate);

  if (!category) {
    errors.push({
      field: 'category',
      message: 'קטגוריית מסמך היא שדה חובה',
      value: input.category,
    });
  } else if (!DOCUMENT_CATEGORIES.includes(category)) {
    errors.push({
      field: 'category',
      message: 'קטגוריית מסמך לא תקינה',
      value: input.category,
    });
  }

  if ((periodMonth === undefined) !== (periodYear === undefined)) {
    errors.push({
      field: 'periodMonth',
      message: 'חודש ושנה חייבים להישלח יחד',
      value: input.periodMonth,
    });
    errors.push({
      field: 'periodYear',
      message: 'חודש ושנה חייבים להישלח יחד',
      value: input.periodYear,
    });
  }

  if (periodMonth !== undefined) {
    if (!Number.isInteger(periodMonth) || periodMonth < 1 || periodMonth > 12) {
      errors.push({
        field: 'periodMonth',
        message: 'חודש חייב להיות מספר בין 1 ל-12',
        value: input.periodMonth,
      });
    }
  }

  if (periodYear !== undefined) {
    if (!Number.isInteger(periodYear) || periodYear < 2000 || periodYear > 2100) {
      errors.push({
        field: 'periodYear',
        message: 'שנה חייבת להיות מספר בין 2000 ל-2100',
        value: input.periodYear,
      });
    }
  }

  if (
    documentDate !== undefined &&
    (!(documentDate instanceof Date) || Number.isNaN(documentDate.getTime()))
  ) {
    errors.push({
      field: 'documentDate',
      message: 'תאריך מסמך חייב להיות בפורמט ISO תקין',
      value: input.documentDate,
    });
  }

  if (errors.length > 0) {
    buildValidationError(errors);
  }

  return {
    category,
    source: DEFAULT_DOCUMENT_METADATA.source,
    ...(periodMonth !== undefined && { periodMonth }),
    ...(periodYear !== undefined && { periodYear }),
    ...(documentDate instanceof Date && { documentDate }),
  };
};

const getDocumentMetadata = rawDocument => {
  const metadata = rawDocument?.metadata || {};
  const normalized = {
    category:
      typeof metadata.category === 'string' &&
      DOCUMENT_CATEGORIES.includes(metadata.category)
        ? metadata.category
        : DEFAULT_DOCUMENT_METADATA.category,
    source:
      typeof metadata.source === 'string' ? metadata.source : DEFAULT_DOCUMENT_METADATA.source,
  };

  if (Number.isInteger(metadata.periodMonth)) {
    normalized.periodMonth = metadata.periodMonth;
  }

  if (Number.isInteger(metadata.periodYear)) {
    normalized.periodYear = metadata.periodYear;
  }

  if (metadata.documentDate) {
    normalized.documentDate = metadata.documentDate;
  }

  return normalized;
};

module.exports = {
  DOCUMENT_CATEGORIES,
  DEFAULT_DOCUMENT_METADATA,
  normalizeDocumentMetadataInput,
  getDocumentMetadata,
};
