'use strict';

const { isAnalyzableGemelHolding, hasGemelHoldingData } = require('../../ai/tools/gemelTools');

describe('gemel holdings helpers', () => {
  it('includes closed/inactive Har HaKesef rows when balance exists', () => {
    const fund = {
      fundType: 'provident_fund',
      status: 'closed',
      isActive: false,
      currentBalance: 40197,
    };
    expect(hasGemelHoldingData(fund)).toBe(true);
    expect(isAnalyzableGemelHolding(fund)).toBe(true);
  });

  it('excludes empty closed rows', () => {
    const fund = {
      fundType: 'study_fund',
      status: 'closed',
      isActive: false,
      currentBalance: 0,
      monthlyEmployeeDeposit: 0,
      monthlyEmployerDeposit: 0,
    };
    expect(isAnalyzableGemelHolding(fund)).toBe(false);
  });

  it('includes active funds without balance', () => {
    const fund = {
      fundType: 'study_fund',
      status: 'active',
      isActive: true,
      currentBalance: null,
    };
    expect(isAnalyzableGemelHolding(fund)).toBe(true);
  });
});
