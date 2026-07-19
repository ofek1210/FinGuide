'use strict';

/**
 * @param {number[]} values
 * @returns {number|null}
 */
function median(values) {
  const nums = (values || []).filter(v => v != null && Number.isFinite(v)).sort((a, b) => a - b);
  if (!nums.length) return null;
  const mid = Math.floor(nums.length / 2);
  return nums.length % 2 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
}

/**
 * @param {number[]} values
 * @returns {number|null}
 */
function average(values) {
  const nums = (values || []).filter(v => v != null && Number.isFinite(v));
  if (!nums.length) return null;
  return nums.reduce((s, v) => s + v, 0) / nums.length;
}

/**
 * Percentile rank of value within cohort (0–100).
 * @param {number|null} value
 * @param {number[]} cohort
 * @returns {number|null}
 */
function percentileRank(value, cohort) {
  if (value == null || !Number.isFinite(value)) return null;
  const nums = (cohort || []).filter(v => v != null && Number.isFinite(v));
  if (!nums.length) return null;
  const below = nums.filter(v => v <= value).length;
  return Math.round((below / nums.length) * 100);
}

/**
 * @param {number|null} percentile
 * @returns {'above'|'below'|'at'|null}
 */
function positionVsMedian(percentile) {
  if (percentile == null) return null;
  if (percentile > 50) return 'above';
  if (percentile < 50) return 'below';
  return 'at';
}

module.exports = { median, average, percentileRank, positionVsMedian };
