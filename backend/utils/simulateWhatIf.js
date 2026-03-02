const { normalizeAmount } = require('./numeric');
const { validateSalary } = require('./validateSalary');
const { ValidationError } = require('./appErrors');

const SUPPORTED_CHANGE_TYPES = ['gross_percent', 'gross_amount'];

const ensureValidChange = change => {
  if (!change || typeof change !== 'object') {
    throw new ValidationError('change is required', [
      { field: 'change', message: 'change is required', value: change },
    ]);
  }

  const { type, value } = change;

  if (!SUPPORTED_CHANGE_TYPES.includes(type)) {
    throw new ValidationError('Invalid change type', [
      { field: 'change.type', message: 'Invalid change type', value: type },
    ]);
  }

  if (!Number.isFinite(value)) {
    throw new ValidationError('change value must be a number', [
      { field: 'change.value', message: 'change value must be a number', value },
    ]);
  }

  return { type, value };
};

const simulateWhatIf = ({ gross, net, change }) => {
  const { grossSalary, netSalary } = validateSalary({
    grossSalary: gross,
    netSalary: net,
  });

  const { type, value } = ensureValidChange(change);

  const netRatio = netSalary / grossSalary;

  const newGross =
    type === 'gross_percent'
      ? grossSalary * (1 + value)
      : grossSalary + value;

  const newNet = newGross * netRatio;

  const deltaGross = newGross - grossSalary;
  const deltaNet = newNet - netSalary;

  return {
    original: {
      gross: grossSalary,
      net: netSalary,
    },
    scenario: {
      gross: normalizeAmount(newGross),
      net: normalizeAmount(newNet),
    },
    delta: {
      gross: normalizeAmount(deltaGross),
      net: normalizeAmount(deltaNet),
    },
  };
};

module.exports = {
  simulateWhatIf,
};
