const {
  canonicalExpensePeriod,
  normalizeBreakdownInput,
  sumBreakdown,
  applyPeriodExpenseUpdate,
  serializeByPeriod,
} = require('../../utils/monthlyExpensesPeriod');

describe('monthlyExpensesPeriod', () => {
  it('canonicalExpensePeriod accepts YYYY-MM', () => {
    expect(canonicalExpensePeriod('2026-07')).toBe('2026-07');
    expect(canonicalExpensePeriod('07/2026')).toBe('2026-07');
  });

  it('applyPeriodExpenseUpdate stores per-month breakdown', () => {
    const financial = { monthlyExpensesByPeriod: new Map() };
    applyPeriodExpenseUpdate(financial, {
      period: '2026-06',
      monthlyExpensesBreakdown: { rent: 4000, food: 1200 },
      monthlyDebts: 800,
    });

    const serialized = serializeByPeriod(financial.monthlyExpensesByPeriod);
    expect(serialized['2026-06'].total).toBe(5200);
    expect(serialized['2026-06'].monthlyDebts).toBe(800);
    expect(sumBreakdown(serialized['2026-06'].breakdown)).toBe(5200);
    expect(financial.monthlyExpensesEstimate).toBe(5200);
  });

  it('stores otherEstimate when no categories', () => {
    const financial = { monthlyExpensesByPeriod: new Map() };
    applyPeriodExpenseUpdate(financial, {
      period: '2026-05',
      monthlyExpenses: 3500,
      otherEstimate: 3500,
    });

    const serialized = serializeByPeriod(financial.monthlyExpensesByPeriod);
    expect(serialized['2026-05'].otherEstimate).toBe(3500);
    expect(serialized['2026-05'].total).toBe(3500);
    expect(normalizeBreakdownInput({ rent: 0, food: -1 })).toEqual({ rent: null, food: null });
  });
});
