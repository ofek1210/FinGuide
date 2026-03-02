const { normalizeAmount, enforceAmountBounds } = require('../utils/numeric');

const ALLOWED_SOURCES = ['gross', 'net', 'deduction'];

const createMonetaryValue = ({ amount, currency = 'ILS', source }) => {
  if (!ALLOWED_SOURCES.includes(source)) {
    throw new Error('Invalid monetary source');
  }

  const normalizedAmount = normalizeAmount(amount);
  enforceAmountBounds(normalizedAmount);

  return {
    amount: normalizedAmount,
    currency,
    source,
  };
};

module.exports = { createMonetaryValue };
