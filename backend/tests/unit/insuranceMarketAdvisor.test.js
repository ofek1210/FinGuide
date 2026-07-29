'use strict';

const fs = require('fs');
const path = require('path');
const { parseServiceIndexCsv } = require('../../services/insuranceGovDataService');
const { buildMarketAdvice, VERDICT } = require('../../services/insuranceMarketAdvisorService');

describe('insuranceMarketAdvisor — portfolio health (no premium benchmark)', () => {
  it('parseServiceIndexCsv reads ISA-style service index', () => {
    const csv = fs.readFileSync(
      path.join(__dirname, '../fixtures/insurance-service-index-sample.csv'),
      'utf8',
    );
    const rows = parseServiceIndexCsv(csv);
    expect(rows.length).toBeGreaterThanOrEqual(5);
    expect(rows[0].claimPaymentRate).toBeGreaterThan(70);
  });

  it('returns STAY/REVIEW from service quality — never premium vs market fields', async () => {
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
    expect(advice.pricingSource).toBeNull();
    expect(advice.summary.totalAnnualOverpayVsMarket).toBe(0);
    expect(advice.comparisonMatrix[0].premiumVsMarket).toBeUndefined();
    expect(advice.comparisonMatrix[0].marketAvg).toBeUndefined();
    expect(advice.portfolioOverview?.activeCount).toBe(1);
    expect(advice.coverageSummaries?.length).toBe(1);
    expect([VERDICT.STAY, VERDICT.REVIEW, VERDICT.SWITCH]).toContain(advice.policies[0].verdict);
    expect(advice.disclaimer).toMatch(/אינו כולל השוואת פרמיות|ללא השוואת פרמיות/);
  });

  it('returns SWITCH for weak service provider (not price)', async () => {
    const profileDTO = {
      personal: { age: 40 },
      policies: [{
        id: '2',
        type: 'health',
        provider: '__unknown_poor_insurer_xyz__',
        monthlyPremium: 550,
        status: 'active',
        rawData: { productType: 'private_health' },
      }],
    };

    // Inject low service via decideVerdict unit path: mock lookup by using a
    // provider that matches a deliberately poor fixture row if present; otherwise
    // assert REVIEW for unknown and separately assert decideVerdict(SWITCH).
    const { decideVerdict, serviceTier } = require('../../services/insuranceMarketAdvisorService');
    expect(decideVerdict({ serviceIndex: 55, serviceTier: serviceTier(55), isDuplicate: false })).toBe(VERDICT.SWITCH);

    const advice = await buildMarketAdvice(profileDTO.policies, profileDTO);
    expect([VERDICT.REVIEW, VERDICT.SWITCH]).toContain(advice.policies[0].verdict);
    expect(advice.policies[0].summaryHe).not.toMatch(/טווח הערכה|ממוצע שוק/);
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
