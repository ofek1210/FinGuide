const parseNumericInput = value => {
  if (value === null || value === undefined) {
    throw new Error('Numeric value is required');
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error('Numeric value must be finite');
    }
    return value;
  }

  if (typeof value !== 'string') {
    throw new Error('Numeric value must be a string or number');
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error('Numeric value is required');
  }

  // הסר תווים שאינם ספרות, מפרידי אלפים/עשרוניים, וסימן מינוס
  let normalized = trimmed.replace(/[^0-9,.-]/g, '');

  const minusCount = (normalized.match(/-/g) || []).length;
  if (minusCount > 1 || (minusCount === 1 && normalized[0] !== '-')) {
    throw new Error('Numeric value must be a valid number');
  }

  const sign = normalized.startsWith('-') ? '-' : '';
  if (sign) {
    normalized = normalized.slice(1);
  }

  const hasComma = normalized.includes(',');
  const hasDot = normalized.includes('.');

  const isGroupedThousands = (text, separator) => {
    const escaped = separator === '.' ? '\\.' : separator;
    const groupedPattern = new RegExp(`^\\d{1,3}(${escaped}\\d{3})+$`);
    return groupedPattern.test(text);
  };

  let decimalSeparator = null;

  if (hasComma && hasDot) {
    decimalSeparator =
      normalized.lastIndexOf(',') > normalized.lastIndexOf('.') ? ',' : '.';
  } else if (hasComma) {
    decimalSeparator = isGroupedThousands(normalized, ',') ? null : ',';
  } else if (hasDot) {
    decimalSeparator = isGroupedThousands(normalized, '.') ? null : '.';
  }

  if (decimalSeparator === ',') {
    normalized = normalized.replace(/\./g, '').replace(/,/g, '.');
  } else if (decimalSeparator === '.') {
    normalized = normalized.replace(/,/g, '');
    const firstDotIndex = normalized.indexOf('.');
    if (firstDotIndex !== -1) {
      normalized =
        normalized.slice(0, firstDotIndex + 1) +
        normalized.slice(firstDotIndex + 1).replace(/\./g, '');
    }
  } else {
    normalized = normalized.replace(/[.,]/g, '');
  }

  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    throw new Error('Numeric value must be a valid number');
  }

  const num = Number(`${sign}${normalized}`);

  if (!Number.isFinite(num)) {
    throw new Error('Numeric value must be a valid number');
  }

  return num;
};

const normalizeAmount = value => {
  const num = typeof value === 'number' ? value : parseNumericInput(value);

  if (!Number.isFinite(num)) {
    throw new Error('Amount must be a valid number');
  }

  // עיגול לשתי ספרות אחרי הנקודה כדי למנוע בעיות floating point
  const rounded = Math.round((num + Number.EPSILON) * 100) / 100;

  // אם אין חלק עשרוני משמעותי – החזר מספר שלם
  if (Number.isInteger(rounded)) {
    return rounded;
  }

  return rounded;
};

module.exports = {
  parseNumericInput,
  normalizeAmount,
};
