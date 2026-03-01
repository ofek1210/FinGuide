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

  // הסר תווים שאינם ספרות, מפרידי אלפים או עשרוניים, וסימן מינוס
  let normalized = trimmed.replace(/[^0-9,.\-]/g, '');

  const hasComma = normalized.includes(',');
  const hasDot = normalized.includes('.');

  if (hasComma && !hasDot) {
    // מצב כמו "10,5" → 10.5 (אנגלי: פסיק כסימן עשרוני)
    normalized = normalized.replace(',', '.');
  } else {
    // הסר פסיקים כמפרידי אלפים, השאר נקודה כסימן עשרוני
    normalized = normalized.replace(/,/g, '');
  }

  const num = Number(normalized);

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

