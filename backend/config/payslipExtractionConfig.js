'use strict';

/**
 * Payslip extraction mode and vision-model settings.
 *
 * PAYSLIP_EXTRACTION_MODE:
 *   legacy (default) — regex/heuristic pipeline in payslipOcr.js
 *   vision           — single-call Claude vision extraction
 *
 * TODO(cleanup-2026-08-15): Remove legacy regex pipeline once vision path
 * passes all golden fixtures and runs in production for ~2 weeks.
 */

const EXTRACTION_MODE = (process.env.PAYSLIP_EXTRACTION_MODE || 'legacy').toLowerCase();

// Sonnet 4.6 for accuracy on dense IDF layouts; override with PAYSLIP_VISION_MODEL=claude-haiku-4-5 to save cost.
const VISION_MODEL = process.env.PAYSLIP_VISION_MODEL || 'claude-sonnet-4-6';
const VISION_MAX_TOKENS = Number(process.env.PAYSLIP_VISION_MAX_TOKENS) > 0
  ? Number(process.env.PAYSLIP_VISION_MAX_TOKENS)
  : 1500;
const VISION_DPI = Number(process.env.PAYSLIP_VISION_DPI) > 0
  ? Number(process.env.PAYSLIP_VISION_DPI)
  : 250;
const VISION_MAX_IMAGE_WIDTH = Number(process.env.PAYSLIP_VISION_MAX_IMAGE_WIDTH) > 0
  ? Number(process.env.PAYSLIP_VISION_MAX_IMAGE_WIDTH)
  : 2200;
const VISION_DUAL_CROP = process.env.PAYSLIP_VISION_DUAL_CROP !== 'false';
const VISION_CONFIDENCE_THRESHOLD = Number(process.env.PAYSLIP_VISION_CONFIDENCE_THRESHOLD) >= 0
  ? Number(process.env.PAYSLIP_VISION_CONFIDENCE_THRESHOLD)
  : 0.65;

function isVisionExtractionMode() {
  return EXTRACTION_MODE === 'vision';
}

module.exports = {
  EXTRACTION_MODE,
  VISION_MODEL,
  VISION_MAX_TOKENS,
  VISION_DPI,
  VISION_MAX_IMAGE_WIDTH,
  VISION_CONFIDENCE_THRESHOLD,
  VISION_DUAL_CROP,
  isVisionExtractionMode,
};
