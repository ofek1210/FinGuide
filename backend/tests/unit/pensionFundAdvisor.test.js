

const fs = require('fs');
const path = require('path');
const { parseGovCsv, staticTracksFromConfig } = require('../../services/pensionGovDataService');
const { buildFundAdvice, VERDICT } = require('../../services/pensionFundAdvisorService');

describe('pensionGovDataService', () => {
  it('parseGovCsv reads Hebrew pension-net style columns', () => {
    const csv = fs.readFileSync(
      path.join(__dirname, '../fixtures/pension-gov-sample.csv'),
      'utf8',
    );
    const tracks = parseGovCsv(csv);
    expect(tracks.length).toBeGreaterThanOrEqual(4);
    expect(tracks.some(t => t.provider === 'מגדל' && t.return5Y != null)).toBe(true);
    expect(tracks.some(t => t.isDefaultSelected)).toBe(true);
  });

  it('staticTracksFromConfig returns benchmark tracks', () => {
    const tracks = staticTracksFromConfig();
    expect(tracks.length).toBeGreaterThan(10);
    expect(tracks[0].return1Y).toBeDefined();
  });
});

describe('pensionFundAdvisorService', () => {
  const profile = { currentAge: 32, retirementAge: 67 };

  it('returns NEGOTIATE for high-fee fund with decent returns', async () => {
    const funds = [{
      fundName: 'הראל מקיפה מניות',
      provider: 'הראל',
      fundType: 'pension_comprehensive',
      riskLevel: 'high',
      currentBalance: 120000,
      monthlyEmployeeDeposit: 800,
      monthlyEmployerDeposit: 900,
      managementFeeAccumulation: 0.0038,
      historicalReturn5Y: 7.0,
      status: 'active',
    }];

    const advice = await buildFundAdvice(funds, profile);
    expect(advice.hasData).toBe(true);
    expect(advice.funds[0].verdict).toBe(VERDICT.NEGOTIATE);
    expect(advice.funds[0].financialImpact.gainIfNegotiateFees).toBeGreaterThan(0);
  });

  it('returns SWITCH recommendation with alternatives for underperforming fund', async () => {
    const funds = [{
      fundName: 'מגדל מקיפה סולידי',
      provider: 'מגדל',
      fundType: 'pension_comprehensive',
      riskLevel: 'high',
      currentBalance: 200000,
      monthlyEmployeeDeposit: 1200,
      monthlyEmployerDeposit: 1300,
      managementFeeAccumulation: 0.0045,
      historicalReturn5Y: 3.5,
      status: 'active',
    }];

    const advice = await buildFundAdvice(funds, profile);
    expect(advice.funds[0].verdict).toBe(VERDICT.SWITCH);
    expect(advice.funds[0].alternatives.length).toBeGreaterThan(0);
  });

  it('returns LEAVE for competitive fund', async () => {
    const funds = [{
      fundName: 'מגדל מקיפה מניות',
      provider: 'מגדל',
      fundType: 'pension_comprehensive',
      riskLevel: 'high',
      currentBalance: 180000,
      monthlyEmployeeDeposit: 1000,
      monthlyEmployerDeposit: 1100,
      managementFeeAccumulation: 0.0035,
      historicalReturn5Y: 7.2,
      status: 'active',
    }];

    const advice = await buildFundAdvice(funds, profile);
    expect([VERDICT.LEAVE, VERDICT.NEGOTIATE]).toContain(advice.funds[0].verdict);
  });
});
