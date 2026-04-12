const {
  isPlainObject,
  toNullableNumber,
  toNullableString,
  toConfidence,
} = require('../helpers/contract.utils');

/**
 * Canonical flat keys for Extractor v2 field evidence.
 * Keep this list append-only to preserve compatibility.
 */
const CANONICAL_FIELD_KEYS = Object.freeze([
  'period_month',
  'employee_name',
  'employee_id',
  'employer_name',
  'employer_id',
  'gross_total',
  'net_payable',
  'gross_minus_mandatory_deductions',
  'base_salary',
  'global_overtime',
  'travel_expenses',
  'mandatory_total',
  'income_tax',
  'national_insurance',
  'health_insurance',
  'pension_base_salary',
  'pension_employee',
  'pension_employer',
  'pension_severance',
  'pension_base_for_severance',
  'study_fund_base_salary',
  'study_fund_employee',
  'study_fund_employer',
  'study_fund_employee_rate_percent',
  'study_fund_employer_rate_percent',
  'gross_for_income_tax',
  'taxable_income',
  'marginal_tax_rate_percent',
  'tax_credit_points',
  'tax_credit_points_resident',
  'tax_credit_points_woman',
  'gross_for_national_insurance',
  'employment_start_date',
  'job_percent',
  'hmo',
]);

/**
 * Normalizes a single field evidence object into contract shape.
 * Unknown/missing values are represented as null.
 */
function normalizeFieldEvidence(key, input) {
  if (!CANONICAL_FIELD_KEYS.includes(key)) {
    return null;
  }
  if (!isPlainObject(input)) {
    return null;
  }

  return {
    value:
      typeof input.value === 'number'
        ? toNullableNumber(input.value)
        : toNullableString(input.value),
    sourceText: toNullableString(input.sourceText),
    confidence: toConfidence(input.confidence),
    reasoning: toNullableString(input.reasoning),
    source: isPlainObject(input.source) ? input.source : null,
  };
}

/**
 * Builds a validated extraction result envelope.
 */
function createExtractionResult(fields = {}, meta = {}) {
  const normalizedFields = {};

  if (isPlainObject(fields)) {
    CANONICAL_FIELD_KEYS.forEach((key) => {
      const normalized = normalizeFieldEvidence(key, fields[key]);
      if (normalized) {
        normalizedFields[key] = normalized;
      }
    });
  }

  return {
    meta: {
      extractor: toNullableString(meta.extractor) || 'payslip-extractor-v2',
      version: toNullableString(meta.version) || '0.1.0',
      extractionMethod: toNullableString(meta.extractionMethod),
      debug: isPlainObject(meta.debug) ? meta.debug : null,
    },
    fields: normalizedFields,
  };
}

module.exports = {
  CANONICAL_FIELD_KEYS,
  createExtractionResult,
};
