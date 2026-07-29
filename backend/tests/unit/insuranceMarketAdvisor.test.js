

const fs = require('fs');
const path = require('path');
const { parseServiceIndexCsv } = require('../../services/insuranceGovDataService');
const { buildMarketAdvice, VERDICT } = require('../../services/insuranceMarketAdvisorService');

describe('insuranceMarketAdvisor', () => {
  it('parseServiceIndexCsv reads ISA-style service index', () => {
    const csv = fs.readFileSync(
      path.join(__dirname, '../fixtures/insurance-service-index-sample.csv'),
      'utf8',
    );
    const rows = parseServiceIndexCsv(csv);
    expect(rows.length).toBeGreaterThanOrEqual(5);
    expect(rows[0].claimPaymentRate).toBeGreaterThan(70);
  });

  it('returns STAY for fair premium + strong insurer', async () => {
    const profileDTO = {
      personal: { age: 35, childrenCount: 0 },
      policies: [{
        id: '1',
        type: 'health',
        provider: 'מגדל',
        monthlyPremium: 200,
        status: 'active',
      }],
    };

    const advice = await buildMarketAdvice(profileDTO.policies, profileDTO);
    expect(advice.hasData).toBe(true);
    expect(advice.comparisonMatrix.length).toBe(1);
    expect(advice.pricingSource?.sourceName).toBeTruthy();
    expect(advice.disclaimerEn).toMatch(/not official quotes/i);
    expect([VERDICT.STAY, VERDICT.REVIEW]).toContain(advice.policies[0].verdict);
  });

  it('returns SWITCH for high premium + weak service provider', async () => {
    const profileDTO = {
      personal: { age: 40 },
      policies: [{
        id: '2',
        type: 'health',
        provider: 'פספורט-כארד',
        monthlyPremium: 550,
        status: 'active',
        rawData: { productType: 'private_health' },
      }],
    };

    const advice = await buildMarketAdvice(profileDTO.policies, profileDTO);
    expect(advice.policies[0].verdict).toBe(VERDICT.SWITCH);
    expect(advice.policies[0].alternatives.length).toBeGreaterThan(0);
  });

  it('does not label two broad health policies as duplicates without evidence', async () => {
    const profileDTO = {
      personal: { age: 30 },
      policies: [
        { id: 'a', type: 'health', provider: 'הראל', monthlyPremium: 180, status: 'active' },
        { id: 'b', type: 'health', provider: 'כלל', monthlyPremium: 220, status: 'active' },
      ],
    };

    const advice = await buildMarketAdvice(profileDTO.policies, profileDTO);
    expect(advice.duplicateCount).toBe(0);
    expect(advice.comparisonMatrix.every(r => !r.duplicate)).toBe(true);
  });
});
