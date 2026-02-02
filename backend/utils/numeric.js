const DEFAULT_PRECISION = 2;
const DEFAULT_MIN_AMOUNT = -1_000_000_000;
const DEFAULT_MAX_AMOUNT = 1_000_000_000;

const CURRENCY_SYMBOLS_REGEX = /[₪$€]/g;
const WHITESPACE_REGEX = /\s+/g;

const normalizeNumericString = raw => {
  let value = raw.replace(CURRENCY_SYMBOLS_REGEX, '');
  value = value.replace(WHITESPACE_REGEX, '');

  const hasComma = value.includes(',');
  const hasDot = value.includes('.');

  if (hasComma && hasDot) {
    value = value.replace(/,/g, '');
  } else if (hasComma) {
    const parts = value.split(',');
    if (parts.length === 2) {
      const decimals = parts[1];
      if (decimals.length === 3 && parts[0].length >= 1) {
        value = parts.join('');
      } else {
        value = `${parts[0]}.${parts[1]}`;
      }
    } else {
      value = parts.join('');
    }
  }

  value = value.replace(/_/g, '');

  return value;
};

const parseNumericInput = input => {
  if (typeof input === 'number') {
    if (!Number.isFinite(input)) {
      throw new Error('Invalid numeric input');
    }
    return input;
  }

  if (typeof input !== 'string') {
    throw new Error('Invalid numeric input');
  }

  let value = input.trim();
  if (!value) {
    throw new Error('Invalid numeric input');
  }

  let isNegative = false;
  if (value.startsWith('(') && value.endsWith(')')) {
    isNegative = true;
    value = value.slice(1, -1);
  }

  value = value.replace(CURRENCY_SYMBOLS_REGEX, '').replace(WHITESPACE_REGEX, '');

  if (value.startsWith('-')) {
    isNegative = true;
    value = value.slice(1);
  }

  if (value.endsWith('-')) {
    isNegative = true;
    value = value.slice(0, -1);
  }

  value = normalizeNumericString(value);

  if (!/^\d+(\.\d+)?$/.test(value)) {
    throw new Error('Invalid numeric input');
  }

  let parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error('Invalid numeric input');
  }

  if (isNegative) {
    parsed = -parsed;
  }

  return parsed;
};

const normalizeAmount = (value, precision = DEFAULT_PRECISION) => {
  if (!Number.isFinite(value)) {
    throw new Error('Invalid numeric value');
  }

  const factor = 10 ** precision;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};

const toScaledInt = (value, precision = DEFAULT_PRECISION) => {
  if (!Number.isFinite(value)) {
    throw new Error('Invalid numeric value');
  }

  const factor = 10 ** precision;
  return Math.round(value * factor);
};

const fromScaledInt = (value, precision = DEFAULT_PRECISION) => {
  const factor = 10 ** precision;
  return value / factor;
};

const safeAdd = (a, b) =>
  fromScaledInt(toScaledInt(a, DEFAULT_PRECISION) + toScaledInt(b, DEFAULT_PRECISION));

const safeSub = (a, b) =>
  fromScaledInt(toScaledInt(a, DEFAULT_PRECISION) - toScaledInt(b, DEFAULT_PRECISION));

const isValidAmount = (
  value,
  { min = DEFAULT_MIN_AMOUNT, max = DEFAULT_MAX_AMOUNT } = {}
) => Number.isFinite(value) && value >= min && value <= max;

const enforceAmountBounds = (
  value,
  { min = DEFAULT_MIN_AMOUNT, max = DEFAULT_MAX_AMOUNT } = {}
) => {
  if (!isValidAmount(value, { min, max })) {
    throw new Error(`Amount out of bounds (${min}..${max})`);
  }
  return value;
};

module.exports = {
  parseNumericInput,
  normalizeAmount,
  safeAdd,
  safeSub,
  isValidAmount,
  enforceAmountBounds,
};
