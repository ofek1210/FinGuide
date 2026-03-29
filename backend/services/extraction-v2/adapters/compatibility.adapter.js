const { buildPayslipSummaryV2 } = require('./summary.adapter');

function getFieldValue(fields, key) {
  return fields && fields[key] ? fields[key].value ?? null : null;
}

function toWarnings(validationWarnings = [], validationErrors = []) {
  const warningMessages = Array.isArray(validationWarnings)
    ? validationWarnings.map(w => w.message).filter(Boolean)
    : [];
  const errorMessages = Array.isArray(validationErrors)
    ? validationErrors.map(e => e.message).filter(Boolean)
    : [];
  return [...warningMessages, ...errorMessages];
}

/**
 * Maps v2 flat extraction + validation contracts into compatible analysisData.
 */
function buildCompatibleAnalysisData(input = {}) {
  const rawPayload = input.rawPayload && typeof input.rawPayload === 'object'
    ? input.rawPayload
    : {};
  const extractionResult = input.extractionResult && typeof input.extractionResult === 'object'
    ? input.extractionResult
    : {};
  const validationResult = input.validationResult && typeof input.validationResult === 'object'
    ? input.validationResult
    : {};

  const fields = extractionResult.fields || {};

  const analysisData = {
    schema_version: '2.0',
    pipeline_version: 'extractor-v2',

    period: {
      month: getFieldValue(fields, 'period_month'),
    },

    salary: {
      gross_total: getFieldValue(fields, 'gross_total'),
      net_payable: getFieldValue(fields, 'net_payable'),
      gross_minus_mandatory_deductions: getFieldValue(fields, 'gross_minus_mandatory_deductions'),
      components: [
        { type: 'base_salary', amount: getFieldValue(fields, 'base_salary') },
        { type: 'global_overtime', amount: getFieldValue(fields, 'global_overtime') },
        { type: 'travel_expenses', amount: getFieldValue(fields, 'travel_expenses') },
      ],
    },

    deductions: {
      mandatory: {
        total: getFieldValue(fields, 'mandatory_total'),
        total_is_derived: false,
        income_tax: getFieldValue(fields, 'income_tax'),
        national_insurance: getFieldValue(fields, 'national_insurance'),
        health_insurance: getFieldValue(fields, 'health_insurance'),
      },
      voluntary: {},
    },

    contributions: {
      pension: {
        base_salary_for_pension: getFieldValue(fields, 'pension_base_salary'),
        employee: getFieldValue(fields, 'pension_employee'),
        employer: getFieldValue(fields, 'pension_employer'),
        severance: getFieldValue(fields, 'pension_severance'),
        base_for_severance: getFieldValue(fields, 'pension_base_for_severance'),
      },
      study_fund: {
        base_salary_for_study_fund: getFieldValue(fields, 'study_fund_base_salary'),
        employee: getFieldValue(fields, 'study_fund_employee'),
        employer: getFieldValue(fields, 'study_fund_employer'),
        employee_rate_percent: getFieldValue(fields, 'study_fund_employee_rate_percent'),
        employer_rate_percent: getFieldValue(fields, 'study_fund_employer_rate_percent'),
      },
    },

    tax: {
      gross_for_income_tax: getFieldValue(fields, 'gross_for_income_tax'),
      taxable_income: getFieldValue(fields, 'taxable_income'),
      marginal_tax_rate_percent: getFieldValue(fields, 'marginal_tax_rate_percent'),
      tax_credit_points: getFieldValue(fields, 'tax_credit_points'),
      tax_credit_points_breakdown: {
        resident: getFieldValue(fields, 'tax_credit_points_resident'),
        woman: getFieldValue(fields, 'tax_credit_points_woman'),
      },
    },

    national_insurance: {
      gross_for_national_insurance: getFieldValue(fields, 'gross_for_national_insurance'),
    },

    employment: {
      employment_start_date: getFieldValue(fields, 'employment_start_date'),
      job_percent: getFieldValue(fields, 'job_percent'),
    },

    parties: {
      employer_name: getFieldValue(fields, 'employer_name'),
      employee_name: getFieldValue(fields, 'employee_name'),
      employee_id: getFieldValue(fields, 'employee_id'),
    },

    insurances: {
      hmo: getFieldValue(fields, 'hmo'),
    },

    quality: {
      confidence: rawPayload.confidence ?? null,
      warnings: toWarnings(validationResult.warnings, validationResult.errors),
      debug: rawPayload.debug || {},
      validation: {
        isValid: validationResult.isValid ?? false,
        status: validationResult.status || 'needs_review',
        needsReview: validationResult.needsReview ?? true,
        warnings: validationResult.warnings || [],
        errors: validationResult.errors || [],
      },
    },

    raw: {
      ocr_engine: rawPayload.ocr_engine || null,
      ocr_lang: rawPayload.ocr_lang || null,
      text_sha256: rawPayload.text_sha256 || null,
      rawText: rawPayload.rawText || rawPayload.ocr_text || null,
      ocr_text: rawPayload.ocr_text || rawPayload.rawText || null,
      extractionMethod: rawPayload.extractionMethod || null,
      pages_processed: rawPayload.pages_processed ?? null,
    },

    extraction_v2: extractionResult,
  };

  analysisData.summary = buildPayslipSummaryV2(analysisData);
  return analysisData;
}

module.exports = {
  buildCompatibleAnalysisData,
};
