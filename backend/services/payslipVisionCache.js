'use strict';

/**
 * In-memory cache for vision extraction results keyed by rendered-image SHA-256.
 * Process-scoped (same pattern as llmFieldAdjudicator). Upgrade to MongoDB if
 * persistence across restarts becomes necessary.
 *
 * @module services/payslipVisionCache
 */

const cache = new Map();

function buildCacheKey(imageSha256, model) {
  return `${model}::${imageSha256}`;
}

function get(imageSha256, model) {
  const key = buildCacheKey(imageSha256, model);
  return cache.get(key) || null;
}

function set(imageSha256, model, payload) {
  const key = buildCacheKey(imageSha256, model);
  cache.set(key, payload);
}

function clear() {
  cache.clear();
}

function size() {
  return cache.size;
}

module.exports = {
  get,
  set,
  clear,
  size,
  buildCacheKey,
};
