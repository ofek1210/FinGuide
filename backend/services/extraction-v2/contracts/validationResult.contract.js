const { toNullableString, isPlainObject } = require('../helpers/contract.utils');

const VALIDATION_STATUSES = Object.freeze([
  'auto_approved',
  'needs_review',
  'failed',
]);

function normalizeIssue(issue) {
  if (!isPlainObject(issue)) {
    return null;
  }

  const code = toNullableString(issue.code);
  const message = toNullableString(issue.message);
  const field = toNullableString(issue.field);

  if (!code || !message) {
    return null;
  }

  return { code, message, field };
}

function normalizeIssues(issues) {
  if (!Array.isArray(issues)) {
    return [];
  }
  return issues.map(normalizeIssue).filter(Boolean);
}

function createValidationResult(input = {}) {
  const status = VALIDATION_STATUSES.includes(input.status)
    ? input.status
    : 'needs_review';

  const needsReview = typeof input.needsReview === 'boolean'
    ? input.needsReview
    : status === 'needs_review';

  const errors = normalizeIssues(input.errors);
  const warnings = normalizeIssues(input.warnings);

  const isValid = typeof input.isValid === 'boolean'
    ? input.isValid
    : errors.length === 0 && status !== 'failed';

  return {
    isValid,
    status,
    needsReview,
    warnings,
    errors,
  };
}

module.exports = {
  VALIDATION_STATUSES,
  createValidationResult,
};
