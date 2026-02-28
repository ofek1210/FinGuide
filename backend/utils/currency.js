const { ValidationError } = require('./appErrors');
const { parseNumericInput, normalizeAmount } = require('./numeric');

const CURRENCY_SYMBOLS = {
  '₪': 'ILS',
  $: 'USD',
  '€': 'EUR',
};

const SUPPORTED_CURRENCIES = ['ILS', 'USD', 'EUR'];

const normalizeCurrency = input => {
  if (input === null || input === undefined) {
    throw new ValidationError('Currency value is required', [
      { field: 'currency', message: 'Currency value is required', value: input },
    ]);
  }

  if (typeof input === 'object' && !Array.isArray(input)) {
    const { amount, currency } = input;
    if (!SUPPORTED_CURRENCIES.includes(currency)) {
      throw new ValidationError('Unsupported currency', [
        { field: 'currency', message: 'Unsupported currency', value: currency },
      ]);
    }
    if (!Number.isFinite(amount)) {
      throw new ValidationError('Amount must be a valid number', [
        { field: 'amount', message: 'Amount must be a valid number', value: amount },
      ]);
    }
    return { amount: normalizeAmount(amount), currency };
  }

  if (typeof input !== 'string') {
    throw new ValidationError('Currency value must be a string', [
      { field: 'currency', message: 'Currency value must be a string', value: input },
    ]);
  }

  const trimmed = input.trim();
  if (!trimmed) {
    throw new ValidationError('Currency value is required', [
      { field: 'currency', message: 'Currency value is required', value: input },
    ]);
  }

  let currency = null;
  let numericPart = trimmed;

  const codeMatch = trimmed.match(/\b(ILS|USD|EUR)\b/i);
  if (codeMatch) {
    currency = codeMatch[1].toUpperCase();
    numericPart = numericPart.replace(codeMatch[0], '');
  }

  if (!currency) {
    const symbol = Object.keys(CURRENCY_SYMBOLS).find(key => trimmed.includes(key));
    if (symbol) {
      currency = CURRENCY_SYMBOLS[symbol];
      numericPart = numericPart.replace(symbol, '');
    }
  }

  if (!currency) {
    throw new ValidationError('Currency is required', [
      { field: 'currency', message: 'Currency is required', value: input },
    ]);
  }

  let amount;
  try {
    amount = parseNumericInput(numericPart);
  } catch {
    throw new ValidationError('Amount must be a valid number', [
      { field: 'amount', message: 'Amount must be a valid number', value: input },
    ]);
  }

  return {
    amount: normalizeAmount(amount),
    currency,
  };
};

const formatCurrency = (amount, currency, { locale = 'he-IL', precision = 2 } = {}) => {
  if (!SUPPORTED_CURRENCIES.includes(currency)) {
    throw new ValidationError('Unsupported currency', [
      { field: 'currency', message: 'Unsupported currency', value: currency },
    ]);
  }

  if (!Number.isFinite(amount)) {
    throw new ValidationError('Amount must be a valid number', [
      { field: 'amount', message: 'Amount must be a valid number', value: amount },
    ]);
  }

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  }).format(amount);
};

module.exports = {
  normalizeCurrency,
  formatCurrency,
  SUPPORTED_CURRENCIES,
};
