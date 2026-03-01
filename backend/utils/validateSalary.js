const { parseNumericInput } = require('./numeric');
const { ValidationError } = require('./appErrors');

const toNumber = value => {
  if (typeof value === 'number') {
    return value;
  }

  return parseNumericInput(value);
};

/**
 * מאמת זוג ערכי שכר (ברוטו/נטו) ומחזיר אותם כמספרים תקינים.
 * הפונקציה מאוד שמרנית כדי לא לשבור שימושים קיימים:
 * - דורשת ערכים סופיים וחיוביים
 * - אינה משנה את היחס בין ברוטו לנטו
 */
const validateSalary = ({ grossSalary, netSalary }) => {
  if (grossSalary === undefined || grossSalary === null) {
    throw new ValidationError('grossSalary is required', [
      { field: 'grossSalary', message: 'grossSalary is required', value: grossSalary },
    ]);
  }

  if (netSalary === undefined || netSalary === null) {
    throw new ValidationError('netSalary is required', [
      { field: 'netSalary', message: 'netSalary is required', value: netSalary },
    ]);
  }

  const gross = toNumber(grossSalary);
  const net = toNumber(netSalary);

  if (!Number.isFinite(gross) || gross <= 0) {
    throw new ValidationError('grossSalary must be a positive number', [
      { field: 'grossSalary', message: 'grossSalary must be a positive number', value: grossSalary },
    ]);
  }

  if (!Number.isFinite(net) || net <= 0) {
    throw new ValidationError('netSalary must be a positive number', [
      { field: 'netSalary', message: 'netSalary must be a positive number', value: netSalary },
    ]);
  }

  return {
    grossSalary: gross,
    netSalary: net,
  };
};

module.exports = {
  validateSalary,
};

