const { parseNumericInput, normalizeAmount } = require('./numeric');
const { ValidationError } = require('./appErrors');

const DEFAULT_MIN_GROSS = 0;
const DEFAULT_MAX_GROSS = 1_000_000;
const DEFAULT_MIN_NET = 0;

const buildError = (field, message, value, rule) => ({
  field,
  message,
  value,
  ...(rule ? { rule } : {}),
});

const validateSalary = (
  { grossSalary, netSalary },
  {
    minGross = DEFAULT_MIN_GROSS,
    maxGross = DEFAULT_MAX_GROSS,
    minNet = DEFAULT_MIN_NET,
  } = {}
) => {
  const errors = [];

  let grossValue;
  let netValue;

  if (grossSalary === undefined || grossSalary === null) {
    errors.push(buildError('grossSalary', 'grossSalary הוא שדה חובה', grossSalary, 'required'));
  } else {
    try {
      grossValue = parseNumericInput(grossSalary);
    } catch {
      errors.push(buildError('grossSalary', 'grossSalary חייב להיות מספר תקין', grossSalary, 'number'));
    }
  }

  if (netSalary === undefined || netSalary === null) {
    errors.push(buildError('netSalary', 'netSalary הוא שדה חובה', netSalary, 'required'));
  } else {
    try {
      netValue = parseNumericInput(netSalary);
    } catch {
      errors.push(buildError('netSalary', 'netSalary חייב להיות מספר תקין', netSalary, 'number'));
    }
  }

  if (Number.isFinite(grossValue)) {
    const normalizedGross = normalizeAmount(grossValue);
    if (normalizedGross <= minGross) {
      errors.push(
        buildError(
          'grossSalary',
          'grossSalary חייב להיות מספר חיובי',
          normalizedGross,
          'positive'
        )
      );
    }
    if (normalizedGross > maxGross) {
      errors.push(
        buildError(
          'grossSalary',
          `grossSalary חייב להיות קטן או שווה ל-${maxGross}`,
          normalizedGross,
          'max'
        )
      );
    }
    grossValue = normalizedGross;
  }

  if (Number.isFinite(netValue)) {
    const normalizedNet = normalizeAmount(netValue);
    if (normalizedNet < minNet) {
      errors.push(
        buildError(
          'netSalary',
          'netSalary חייב להיות גדול או שווה ל-0',
          normalizedNet,
          'min'
        )
      );
    }
    netValue = normalizedNet;
  }

  if (Number.isFinite(grossValue) && Number.isFinite(netValue)) {
    if (netValue >= grossValue) {
      errors.push(
        buildError(
          'netSalary',
          'netSalary חייב להיות קטן מ-grossSalary',
          netValue,
          'relation'
        )
      );
    }
  }

  if (errors.length > 0) {
    const message = errors.length === 1 ? errors[0].message : 'שגיאות בולידציה';
    throw new ValidationError(message, errors);
  }

  return {
    grossSalary: grossValue,
    netSalary: netValue,
  };
};

module.exports = {
  validateSalary,
  DEFAULT_MIN_GROSS,
  DEFAULT_MAX_GROSS,
  DEFAULT_MIN_NET,
};
