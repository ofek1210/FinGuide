/* eslint-disable no-restricted-syntax */

/**
 * Zod contract for the payslip extraction payload (`document.analysisData`).
 *
 * Strict only about the four fields the rest of the system relies on:
 *   period.month, salary.gross_total, salary.net_payable,
 *   deductions.mandatory.total.
 *
 * Everything else is allowed through unchanged via passthrough(). Failed
 * validation flags the document `needs_review` and surfaces the reason in
 * `processingError`, instead of saving a half-broken analysis as `completed`.
 *
 * @module schemas/payslipAnalysis.schema
 */

const { z } = require('zod');

const periodMonthSchema = z.string().regex(
  /^(?:\d{4}[-/]\d{1,2}|\d{1,2}[-/]\d{4})$/,
  'period.month must look like YYYY-MM or MM/YYYY',
);

const positiveAmount = z.number()
  .finite('amount must be finite')
  .positive('amount must be positive');

const nonNegativeAmount = z.number()
  .finite('amount must be finite')
  .nonnegative('amount must be ≥ 0');

const payslipAnalysisCriticalSchema = z.object({
  period: z.object({ month: periodMonthSchema }).passthrough(),
  salary: z.object({
    gross_total: positiveAmount,
    net_payable: positiveAmount,
  }).passthrough(),
  deductions: z.object({
    mandatory: z.object({
      total: nonNegativeAmount,
    }).passthrough(),
  }).passthrough(),
}).passthrough();

function deriveMandatoryTotal(mandatory = {}) {
  if (Number.isFinite(mandatory.total) && mandatory.total >= 0) {
    return mandatory;
  }
  const parts = [mandatory.income_tax, mandatory.national_insurance, mandatory.health_insurance]
    .filter(v => Number.isFinite(v));
  if (parts.length === 0) return mandatory;
  return {
    ...mandatory,
    total: +parts.reduce((sum, value) => sum + value, 0).toFixed(2),
    total_is_derived: true,
  };
}

/** Fill derivable critical fields before schema validation (non-destructive clone). */
function normalizePayslipAnalysis(input) {
  if (!input || typeof input !== 'object') return input;
  const data = JSON.parse(JSON.stringify(input));
  if (data.deductions?.mandatory) {
    data.deductions.mandatory = deriveMandatoryTotal(data.deductions.mandatory);
  }
  return data;
}

/**
 * Cross-field sanity rules applied AFTER the schema parses. Kept separate so
 * the rules can grow without bloating the type contract.
 *
 * Returns array of human-readable strings; empty array means no issues.
 */
function detectCrossFieldIssues(data) {
  const issues = [];
  const gross = data?.salary?.gross_total;
  const net = data?.salary?.net_payable;
  const mandatory = data?.deductions?.mandatory?.total;
  const incomeTax = data?.deductions?.mandatory?.income_tax;
  const personalCredit = data?.tax?.personal_credit;

  if (Number.isFinite(gross) && Number.isFinite(net) && net > gross * 1.005) {
    issues.push(`net_payable (${net}) exceeds gross_total (${gross})`);
  }
  if (Number.isFinite(gross) && Number.isFinite(mandatory) && mandatory > gross * 1.005) {
    issues.push(`mandatory_total (${mandatory}) exceeds gross_total (${gross})`);
  }
  // personal_credit cannot exceed income_tax — it's a reduction on the tax owed
  if (Number.isFinite(personalCredit) && Number.isFinite(incomeTax) && personalCredit > incomeTax * 1.005) {
    issues.push(`personal_credit (${personalCredit}) exceeds income_tax (${incomeTax})`);
  }

  const flagged = data?.quality?.flaggedInconsistencies;
  if (Array.isArray(flagged) && flagged.length > 0) {
    issues.push(...flagged);
  }

  return issues;
}

/**
 * Validate the analysis payload. Returns:
 *   { ok: true, data }                         — passes both schema + cross-field
 *   { ok: false, reason, schemaIssues, ... }   — failed; caller should set needs_review
 *
 * Never throws.
 */
function validatePayslipAnalysis(input) {
  const normalized = normalizePayslipAnalysis(input);
  const parsed = payslipAnalysisCriticalSchema.safeParse(normalized);
  if (!parsed.success) {
    const flat = parsed.error.issues.map(issue => `${issue.path.join('.') || '<root>'}: ${issue.message}`);
    return {
      ok: false,
      reason: 'schema_invalid',
      schemaIssues: flat,
      message: `analysisData failed schema: ${flat.join('; ')}`,
    };
  }
  const crossFieldIssues = detectCrossFieldIssues(parsed.data);
  if (crossFieldIssues.length > 0) {
    return {
      ok: false,
      reason: 'cross_field_invalid',
      schemaIssues: [],
      crossFieldIssues,
      message: `analysisData failed cross-field check: ${crossFieldIssues.join('; ')}`,
    };
  }
  return { ok: true, data: normalized };
}

/**
 * Lift the per-field confidence/source from the existing `quality.fields`
 * block into a flatter `fields_meta` shape the frontend can read without
 * digging through the resolver-specific quality contract.
 *
 * Idempotent and safe on partial input — returns `null` if no quality block.
 */
function buildFieldsMeta(analysisData) {
  const qualityFields = analysisData?.quality?.fields;
  if (!qualityFields || typeof qualityFields !== 'object') return null;
  const fieldsMeta = {};
  for (const [field, entry] of Object.entries(qualityFields)) {
    if (!entry || typeof entry !== 'object') continue;
    fieldsMeta[field] = {
      confidence: typeof entry.confidence === 'number' ? entry.confidence : null,
      source: entry.source || null,
      section: entry.section || null,
      abstained: Boolean(entry.abstained),
    };
  }
  return Object.keys(fieldsMeta).length > 0 ? fieldsMeta : null;
}

module.exports = {
  payslipAnalysisCriticalSchema,
  normalizePayslipAnalysis,
  deriveMandatoryTotal,
  validatePayslipAnalysis,
  detectCrossFieldIssues,
  buildFieldsMeta,
};
