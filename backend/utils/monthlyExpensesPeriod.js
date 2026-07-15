const { canonicalPeriodMonth, monthKey } = require('./payslipPeriod');

const BREAKDOWN_KEYS = [
  'rent', 'arnona', 'vaadBayit', 'clothing', 'food',
  'restaurants', 'childcare', 'tvInternet', 'electricity', 'water',
];

function canonicalExpensePeriod(value) {
  if (!value) return null;
  if (typeof value === 'string') return canonicalPeriodMonth(value);
  if (typeof value === 'object') {
    const year = Number(value.year);
    const month = Number(value.month);
    if (Number.isFinite(year) && Number.isFinite(month)) {
      return monthKey(year, month);
    }
  }
  return null;
}

function normalizeBreakdownInput(raw) {
  if (!raw || typeof raw !== 'object') return {};
  const out = {};
  for (const key of BREAKDOWN_KEYS) {
    if (Object.prototype.hasOwnProperty.call(raw, key)) {
      const n = Number(raw[key]);
      out[key] = Number.isFinite(n) && n > 0 ? n : null;
    }
  }
  return out;
}

function sumBreakdown(breakdown) {
  if (!breakdown || typeof breakdown !== 'object') return 0;
  return BREAKDOWN_KEYS.reduce(
    (sum, key) => sum + (Number(breakdown[key]) > 0 ? Number(breakdown[key]) : 0),
    0,
  );
}

function hasBreakdownData(breakdown) {
  return sumBreakdown(breakdown) > 0;
}

function ensurePeriodMap(financial) {
  if (!financial.monthlyExpensesByPeriod) {
    financial.monthlyExpensesByPeriod = new Map();
    return financial.monthlyExpensesByPeriod;
  }
  if (financial.monthlyExpensesByPeriod instanceof Map) {
    return financial.monthlyExpensesByPeriod;
  }
  financial.monthlyExpensesByPeriod = new Map(
    Object.entries(financial.monthlyExpensesByPeriod),
  );
  return financial.monthlyExpensesByPeriod;
}

function serializePeriodEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;
  return {
    breakdown: entry.breakdown || null,
    monthlyDebts: entry.monthlyDebts ?? null,
    otherEstimate: entry.otherEstimate ?? null,
    total: entry.total ?? null,
  };
}

function serializeByPeriod(mapOrObj) {
  if (!mapOrObj) return {};
  const entries = mapOrObj instanceof Map
    ? [...mapOrObj.entries()]
    : Object.entries(mapOrObj);
  const out = {};
  for (const [period, entry] of entries) {
    const serialized = serializePeriodEntry(entry);
    if (serialized) out[period] = serialized;
  }
  return out;
}

function applyPeriodExpenseUpdate(financial, payload) {
  const {
    period,
    monthlyExpenses,
    monthlyDebts,
    monthlyExpensesBreakdown,
    otherEstimate,
  } = payload;

  const key = canonicalExpensePeriod(period);
  if (!key) {
    const err = new Error('תקופת חודש לא תקינה');
    err.statusCode = 400;
    throw err;
  }

  const periodMap = ensurePeriodMap(financial);
  const entry = { ...(periodMap.get(key) || {}) };

  if (monthlyExpensesBreakdown !== undefined && monthlyExpensesBreakdown !== null) {
    entry.breakdown = normalizeBreakdownInput(monthlyExpensesBreakdown);
  }

  if (otherEstimate !== undefined) {
    const other = Number(otherEstimate);
    entry.otherEstimate = Number.isFinite(other) && other > 0 ? other : null;
  }

  if (monthlyDebts !== undefined) {
    const debts = Number(monthlyDebts);
    entry.monthlyDebts = Number.isFinite(debts) && debts > 0 ? debts : null;
  }

  const categoryTotal = hasBreakdownData(entry.breakdown) ? sumBreakdown(entry.breakdown) : 0;
  if (categoryTotal > 0) {
    entry.total = categoryTotal;
    entry.otherEstimate = null;
  } else if (monthlyExpenses !== undefined) {
    const total = Number(monthlyExpenses);
    entry.total = Number.isFinite(total) && total > 0 ? total : null;
  } else if (entry.otherEstimate) {
    entry.total = entry.otherEstimate;
  } else {
    entry.total = null;
  }

  periodMap.set(key, entry);
  if (typeof financial.markModified === 'function') {
    financial.markModified('monthlyExpensesByPeriod');
  }

  financial.monthlyExpensesEstimate = entry.total;
  financial.monthlyDebts = entry.monthlyDebts;
  if (hasBreakdownData(entry.breakdown)) {
    financial.monthlyExpensesBreakdown = entry.breakdown;
    if (typeof financial.markModified === 'function') {
      financial.markModified('monthlyExpensesBreakdown');
    }
  }

  return { period: key, entry };
}

module.exports = {
  BREAKDOWN_KEYS,
  canonicalExpensePeriod,
  normalizeBreakdownInput,
  sumBreakdown,
  hasBreakdownData,
  serializeByPeriod,
  applyPeriodExpenseUpdate,
};
