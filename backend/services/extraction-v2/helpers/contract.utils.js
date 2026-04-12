function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function toNullableNumber(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toNullableString(value) {
  if (value === undefined || value === null) {
    return null;
  }
  const s = String(value).trim();
  return s || null;
}

function toConfidence(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return null;
  }
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

module.exports = {
  isPlainObject,
  toNullableNumber,
  toNullableString,
  toConfidence,
};
