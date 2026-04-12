const { createValidationResult } = require('./contracts/validationResult.contract');

const CRITICAL_FIELDS = Object.freeze([
  'period_month',
  'employee_name',
  'employee_id',
  'gross_total',
  'net_payable',
]);

const CONFIDENCE_THRESHOLDS = Object.freeze({
  criticalWarn: 0.8,
  criticalError: 0.6,
  extremeLowAnyField: 0.25,
});

const TAX_CREDIT_POINTS_RANGE = Object.freeze({
  min: 0,
  max: 20,
});

function isFieldMissing(field) {
  if (!field || typeof field !== 'object') {
    return true;
  }
  const { value } = field;
  if (value === null || value === undefined) {
    return true;
  }
  return typeof value === 'string' && value.trim() === '';
}

function getFieldConfidence(field) {
  if (!field || typeof field !== 'object') {
    return null;
  }
  const n = Number(field.confidence);
  return Number.isFinite(n) ? n : null;
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function addIssue(list, code, field, message) {
  list.push({ code, field, message });
}

function validateCriticalPresence(fields, errors) {
  CRITICAL_FIELDS.forEach((fieldKey) => {
    if (isFieldMissing(fields[fieldKey])) {
      addIssue(errors, 'MISSING_CRITICAL_FIELD', fieldKey, `Critical field is missing: ${fieldKey}`);
    }
  });
}

function validateCriticalConfidence(fields, warnings, errors) {
  CRITICAL_FIELDS.forEach((fieldKey) => {
    const field = fields[fieldKey];
    if (isFieldMissing(field)) {
      return;
    }
    const confidence = getFieldConfidence(field);
    if (confidence === null) {
      addIssue(
        warnings,
        'MISSING_CONFIDENCE',
        fieldKey,
        `Missing confidence for critical field: ${fieldKey}`,
      );
      return;
    }
    if (confidence < CONFIDENCE_THRESHOLDS.criticalError) {
      addIssue(
        errors,
        'LOW_CONFIDENCE_CRITICAL_FIELD',
        fieldKey,
        `Critical field confidence too low (${confidence}): ${fieldKey}`,
      );
      return;
    }
    if (confidence < CONFIDENCE_THRESHOLDS.criticalWarn) {
      addIssue(
        warnings,
        'LOW_CONFIDENCE_CRITICAL_FIELD',
        fieldKey,
        `Critical field confidence is borderline (${confidence}): ${fieldKey}`,
      );
    }
  });
}

function validateIdentityFields(fields, errors) {
  const employeeId = fields.employee_id?.value;
  const employeeName = fields.employee_name?.value;

  if (employeeId !== null && employeeId !== undefined && employeeId !== '') {
    const id = String(employeeId).trim();
    if (!/^\d{7,9}$/.test(id)) {
      addIssue(
        errors,
        'MALFORMED_EMPLOYEE_ID',
        'employee_id',
        'employee_id must contain 7-9 digits.',
      );
    }
  }

  if (employeeName !== null && employeeName !== undefined) {
    const name = String(employeeName).trim();
    const hasLetters = /[A-Za-z\u0590-\u05FF]/.test(name);
    const hasManyDigits = (name.match(/\d/g) || []).length >= 3;
    if (!name || name.length < 2 || !hasLetters || hasManyDigits) {
      addIssue(
        errors,
        'INVALID_EMPLOYEE_NAME',
        'employee_name',
        'employee_name is empty or does not look like a human name.',
      );
    }
  }
}

function validateNumericConsistency(fields, warnings, errors) {
  const gross = toNumber(fields.gross_total?.value);
  const net = toNumber(fields.net_payable?.value);
  const taxCreditPoints = toNumber(fields.tax_credit_points?.value);
  const incomeTax = toNumber(fields.income_tax?.value);
  const nationalInsurance = toNumber(fields.national_insurance?.value);
  const healthInsurance = toNumber(fields.health_insurance?.value);

  if (gross !== null && gross <= 0) {
    addIssue(errors, 'INVALID_GROSS_TOTAL', 'gross_total', 'gross_total must be greater than 0.');
  }
  if (net !== null && net <= 0) {
    addIssue(errors, 'INVALID_NET_PAYABLE', 'net_payable', 'net_payable must be greater than 0.');
  }
  if (gross !== null && net !== null && net > gross) {
    addIssue(
      errors,
      'NET_GREATER_THAN_GROSS',
      'net_payable',
      'net_payable must not be greater than gross_total.',
    );
  }

  if (
    taxCreditPoints !== null &&
    (taxCreditPoints < TAX_CREDIT_POINTS_RANGE.min || taxCreditPoints > TAX_CREDIT_POINTS_RANGE.max)
  ) {
    addIssue(
      warnings,
      'SUSPICIOUS_TAX_CREDIT_POINTS',
      'tax_credit_points',
      `tax_credit_points is outside sane range (${TAX_CREDIT_POINTS_RANGE.min}-${TAX_CREDIT_POINTS_RANGE.max}).`,
    );
  }

  [
    ['income_tax', incomeTax],
    ['national_insurance', nationalInsurance],
    ['health_insurance', healthInsurance],
  ].forEach(([fieldKey, value]) => {
    if (value !== null && value < 0) {
      addIssue(
        errors,
        'NEGATIVE_DEDUCTION_VALUE',
        fieldKey,
        `${fieldKey} must not be negative.`,
      );
    }
  });
}

function validateSourceEvidence(fields, warnings) {
  Object.entries(fields).forEach(([fieldKey, field]) => {
    if (!field || typeof field !== 'object') {
      return;
    }

    if (CRITICAL_FIELDS.includes(fieldKey) && !isFieldMissing(field)) {
      const sourceText = typeof field.sourceText === 'string' ? field.sourceText.trim() : '';
      if (!sourceText) {
        addIssue(
          warnings,
          'MISSING_SOURCE_TEXT',
          fieldKey,
          `Critical field is missing sourceText evidence: ${fieldKey}`,
        );
      }
    }

    const confidence = getFieldConfidence(field);
    if (confidence !== null && confidence < CONFIDENCE_THRESHOLDS.extremeLowAnyField) {
      addIssue(
        warnings,
        'EXTREMELY_LOW_CONFIDENCE',
        fieldKey,
        `Field confidence is extremely low (${confidence}).`,
      );
    }
  });
}

function deriveValidationStatus(errors, warnings) {
  if (errors.length > 0) {
    return {
      isValid: false,
      status: 'failed',
      needsReview: true,
    };
  }

  if (warnings.length > 0) {
    return {
      isValid: true,
      status: 'needs_review',
      needsReview: true,
    };
  }

  return {
    isValid: true,
    status: 'auto_approved',
    needsReview: false,
  };
}

function validatePayslipExtraction(input = {}) {
  const { extractionResult } = input;

  if (!extractionResult || typeof extractionResult !== 'object') {
    return createValidationResult({
      isValid: false,
      status: 'failed',
      needsReview: true,
      warnings: [],
      errors: [
        {
          code: 'INVALID_EXTRACTION_RESULT',
          field: null,
          message: 'Missing or invalid extraction result envelope.',
        },
      ],
    });
  }

  const fields = extractionResult.fields && typeof extractionResult.fields === 'object'
    ? extractionResult.fields
    : {};

  const warnings = [];
  const errors = [];

  validateCriticalPresence(fields, errors);
  validateCriticalConfidence(fields, warnings, errors);
  validateIdentityFields(fields, errors);
  validateNumericConsistency(fields, warnings, errors);
  validateSourceEvidence(fields, warnings);

  const statusMeta = deriveValidationStatus(errors, warnings);

  return createValidationResult({
    ...statusMeta,
    warnings,
    errors,
  });
}

module.exports = {
  validatePayslipExtraction,
  CRITICAL_FIELDS,
};
