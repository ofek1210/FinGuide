'use strict';

/**
 * Helpers to detect missing payslip identity fields and merge Vision fill-ins
 * into a legacy OCR result.
 */

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function getMissingIdentityFields(data) {
  const missing = [];
  if (!hasText(data?.parties?.employee_name)) missing.push('employee_name');
  if (!hasText(data?.parties?.employee_id)) missing.push('employee_id');
  if (!hasText(data?.period?.month)) missing.push('period_month');
  return missing;
}

function needsIdentityVisionFallback(data) {
  return getMissingIdentityFields(data).length > 0;
}

/**
 * Copy missing identity fields from vision → ocr result (in place).
 * Also fills employer_name when missing.
 */
function mergeIdentityFromVision(ocrData, visionData) {
  if (!ocrData || !visionData) return { filled: [] };
  const filled = [];

  if (!ocrData.parties) ocrData.parties = {};
  if (!ocrData.period) ocrData.period = {};
  if (!ocrData.quality) ocrData.quality = {};
  if (!ocrData.quality.fields) ocrData.quality.fields = {};

  const vParties = visionData.parties || {};
  const vFields = visionData.quality?.fields || {};

  if (!hasText(ocrData.parties.employee_name) && hasText(vParties.employee_name)) {
    ocrData.parties.employee_name = vParties.employee_name.trim();
    if (vFields.employee_name) ocrData.quality.fields.employee_name = vFields.employee_name;
    filled.push('employee_name');
  }

  if (!hasText(ocrData.parties.employee_id) && hasText(vParties.employee_id)) {
    const digits = String(vParties.employee_id).replace(/\D/g, '');
    ocrData.parties.employee_id = /^\d{7,9}$/.test(digits) ? digits : vParties.employee_id.trim();
    if (vFields.employee_id) ocrData.quality.fields.employee_id = vFields.employee_id;
    filled.push('employee_id');
  }

  if (!hasText(ocrData.parties.employer_name) && hasText(vParties.employer_name)) {
    ocrData.parties.employer_name = vParties.employer_name.trim();
    if (vFields.employer_name) ocrData.quality.fields.employer_name = vFields.employer_name;
    filled.push('employer_name');
  }

  if (!hasText(ocrData.period.month) && hasText(visionData.period?.month)) {
    ocrData.period.month = visionData.period.month;
    if (vFields.period_month) ocrData.quality.fields.period_month = vFields.period_month;
    filled.push('period_month');
  }

  if (filled.length) {
    ocrData.quality.warnings = [
      ...(ocrData.quality.warnings || []),
      `Identity fields filled via Vision: ${filled.join(', ')}`,
    ];
    if (!ocrData.raw) ocrData.raw = {};
    ocrData.raw.identity_vision_fallback = true;
    ocrData.raw.identity_vision_filled = filled;
  }

  return { filled };
}

module.exports = {
  getMissingIdentityFields,
  needsIdentityVisionFallback,
  mergeIdentityFromVision,
};
