'use strict';

/**
 * Normalize a percentage value to 0–100 scale exactly once.
 * @param {number|string|null|undefined} value
 * @returns {{ value: number|null, valid: boolean, raw: unknown }}
 */
function normalizePercentage(value) {
  if (value == null || value === '') {
    return { value: null, valid: false, raw: value };
  }

  let n = value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/%/g, '').trim();
    if (!cleaned) return { value: null, valid: false, raw: value };
    n = Number(cleaned);
  }

  if (!Number.isFinite(n)) {
    return { value: null, valid: false, raw: value };
  }

  let normalized = n;
  if (Math.abs(n) <= 1 && n !== 0) {
    normalized = n * 100;
  }

  if (normalized < 0 || normalized > 100) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[normalizePercentage] invalid percentage excluded:', value, '→', normalized);
    }
    return { value: null, valid: false, raw: value };
  }

  return { value: Math.round(normalized * 10) / 10, valid: true, raw: value };
}

/**
 * Stock/foreign exposure from Pensia-Net may be absolute (millions) or percent.
 * When totalAssets (millions) is available, derive percent from ratio.
 */
function normalizeExposurePercent(exposure, totalAssetsMillions) {
  const direct = normalizePercentage(exposure);
  if (direct.valid) return direct;

  if (exposure != null && totalAssetsMillions != null && totalAssetsMillions > 0) {
    const abs = Number(exposure);
    if (Number.isFinite(abs) && abs > 100) {
      const derived = (abs / totalAssetsMillions) * 100;
      const derivedNorm = normalizePercentage(derived);
      if (derivedNorm.valid) return derivedNorm;
    }
  }

  return { value: null, valid: false, raw: exposure };
}

module.exports = { normalizePercentage, normalizeExposurePercent };
