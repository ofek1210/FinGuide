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
});
