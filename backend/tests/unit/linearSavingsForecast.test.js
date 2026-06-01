const { buildLinearSavingsScenario } = require('../../utils/linearSavingsForecast');

describe('buildLinearSavingsScenario', () => {
  it('builds a linear yearly timeline until retirement', () => {
    const scenario = buildLinearSavingsScenario({
      currentBalance: 100000,
      currentAge: 30,
      retirementAge: 33,
      monthlyContribution: 1000,
      currentYear: 2026,
    });

    expect(scenario.monthlyContribution).toBe(1000);
    expect(scenario.monthsToRetirement).toBe(36);
    expect(scenario.projectedBalance).toBe(136000);
    expect(scenario.timeline).toEqual([
      {
        yearIndex: 0,
        age: 30,
        calendarYear: 2026,
        monthsFromNow: 0,
        projectedBalance: 100000,
      },
      {
        yearIndex: 1,
        age: 31,
        calendarYear: 2027,
        monthsFromNow: 12,
        projectedBalance: 112000,
      },
      {
        yearIndex: 2,
        age: 32,
        calendarYear: 2028,
        monthsFromNow: 24,
        projectedBalance: 124000,
      },
      {
        yearIndex: 3,
        age: 33,
        calendarYear: 2029,
        monthsFromNow: 36,
        projectedBalance: 136000,
      },
    ]);
  });

  it('handles a single year until retirement', () => {
    const scenario = buildLinearSavingsScenario({
      currentBalance: 50000,
      currentAge: 64,
      retirementAge: 65,
      monthlyContribution: 2000,
      currentYear: 2026,
    });

    expect(scenario.monthsToRetirement).toBe(12);
    expect(scenario.projectedBalance).toBe(74000);
    expect(scenario.timeline).toHaveLength(2);
  });

  it('supports zero balance and zero contribution', () => {
    const scenario = buildLinearSavingsScenario({
      currentBalance: 0,
      currentAge: 40,
      retirementAge: 42,
      monthlyContribution: 0,
      currentYear: 2026,
    });

    expect(scenario.projectedBalance).toBe(0);
    expect(scenario.timeline.every(point => point.projectedBalance === 0)).toBe(true);
  });

  it('normalizes decimal contribution totals', () => {
    const scenario = buildLinearSavingsScenario({
      currentBalance: 1000,
      currentAge: 30,
      retirementAge: 31,
      monthlyContribution: 100.555,
      currentYear: 2026,
    });

    expect(scenario.monthlyContribution).toBe(100.56);
    expect(scenario.projectedBalance).toBe(2206.66);
  });
});
