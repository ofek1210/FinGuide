const { ValidationError } = require('./appErrors');
const { parseNumericInput } = require('./numeric');

const normalizePercent = input => {
  if (input === null || input === undefined) {
    throw new ValidationError('Percent value is required', [
      { field: 'percent', message: 'Percent value is required', value: input },
    ]);
  }

  let value = input;
  let isPercentNotation = false;

  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed) {
      throw new ValidationError('Percent value is required', [
        { field: 'percent', message: 'Percent value is required', value: input },
      ]);
    }

    if (trimmed.includes('%')) {
      isPercentNotation = true;
      value = trimmed.replace('%', '').trim();
    } else {
      value = trimmed;
    }
  }

  let numericValue;
  try {
    numericValue = typeof value === 'number' ? value : parseNumericInput(value);
  } catch {
    throw new ValidationError('Percent value must be a valid number', [
      { field: 'percent', message: 'Percent value must be a valid number', value: input },
    ]);
  }

  let normalized;
  if (isPercentNotation) {
    normalized = numericValue / 100;
  } else if (numericValue > 1 && numericValue <= 100) {
    normalized = numericValue / 100;
  } else {
    normalized = numericValue;
  }

  if (!Number.isFinite(normalized) || normalized < 0 || normalized > 1) {
    throw new ValidationError('Percent must be between 0 and 1', [
      { field: 'percent', message: 'Percent must be between 0 and 1', value: input },
    ]);
  }

  return normalized;
};

const formatPercent = (value, { locale = 'en-US', precision = 0 } = {}) => {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new ValidationError('Percent must be between 0 and 1', [
      { field: 'percent', message: 'Percent must be between 0 and 1', value },
    ]);
  }

  return new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  }).format(value);
};

module.exports = {
  normalizePercent,
  formatPercent,
};
