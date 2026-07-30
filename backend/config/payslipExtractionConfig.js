'use strict';

/**
 * Payslip extraction mode and vision-model settings.
 *
 * PAYSLIP_EXTRACTION_MODE:
 *   legacy (default) — regex/heuristic pipeline in payslipOcr.js
 *   vision           — single-call Claude vision extraction
 *
 * Vision is opt-in only. Set PAYSLIP_EXTRACTION_MODE=vision and/or
 * PAYSLIP_VISION_IDENTITY_FALLBACK=true explicitly when you want Claude Vision.
 */

const EXTRACTION_MODE = (process.env.PAYSLIP_EXTRACTION_MODE || 'legacy').toLowerCase();

// Sonnet 4.x for dense Israeli payslip layouts (default: 4.6). Override with PAYSLIP_VISION_MODEL.
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

/** Off by default — enable with PAYSLIP_VISION_IDENTITY_FALLBACK=true. */
const VISION_IDENTITY_FALLBACK = process.env.PAYSLIP_VISION_IDENTITY_FALLBACK === 'true';

function isVisionExtractionMode() {
  return EXTRACTION_MODE === 'vision';
}

function shouldFallbackVisionForIdentity() {
  return VISION_IDENTITY_FALLBACK && Boolean(process.env.ANTHROPIC_API_KEY);
}

module.exports = {
  EXTRACTION_MODE,
  VISION_MODEL,
  VISION_MAX_TOKENS,
  VISION_DPI,
  VISION_MAX_IMAGE_WIDTH,
  VISION_CONFIDENCE_THRESHOLD,
  VISION_DUAL_CROP,
  VISION_IDENTITY_FALLBACK,
  isVisionExtractionMode,
  shouldFallbackVisionForIdentity,
};
