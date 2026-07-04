'use strict';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const {
  normalizeRiskLevel,
  normalizeFinqFund,
  getLeadingFunds,
  getFundById,
  buildLeadingFundsUrl,
  seedCacheForTests,
  clearLeadingFundsCache,
} = require('../../services/PensionService');

describe('PensionService (Finq leading funds)', () => {
  let mongoServer;
  let originalFetch;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    originalFetch = global.fetch;
  });

  afterAll(async () => {
    global.fetch = originalFetch;
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await clearLeadingFundsCache();
    global.fetch = jest.fn();
    process.env.FINQ_AUTH_TOKEN = 'test-token';
    process.env.FINQ_ENABLED = 'true';
  });

  it('normalizeRiskLevel defaults to MEDIUM and accepts aliases', () => {
    expect(normalizeRiskLevel(undefined)).toBe('MEDIUM');
    expect(normalizeRiskLevel('high')).toBe('HIGH');
    expect(normalizeRiskLevel('elevated')).toBe('INCREASED');
  });

  it('buildLeadingFundsUrl uses Finq riskLevel + sortBy enums', () => {
    const url = buildLeadingFundsUrl('HIGH');
    expect(url).toContain('riskLevel=3');
    expect(url).toContain('category=COMPERHENSIVE');
    expect(url).toContain('sortBy=yield36Months');
  });

  it('normalizeFinqFund maps Finq payload to stable DTO', () => {
    const dto = normalizeFinqFund(
      {
        fundId: 'f1',
        routeName: 'הפניקס פנסיה מקיפה - כללי',
        shortText: 'הפניקס',
        yield36Months: 37.26,
        avgAnnualManagementFee: 0.14,
        avgDepositFee: 1.53,
        finqRank: 2,
        finqRiskLevel: 2,
      },
      'MEDIUM',
    );
    expect(dto.fundName).toBe('הפניקס פנסיה מקיפה - כללי');
    expect(dto.managingBody).toBe('הפניקס');
    expect(dto.yield3Years).toBe(37.26);
    expect(dto.finqRank).toBe(2);
  });

  it('getLeadingFunds caches per risk level independently', async () => {
    global.fetch.mockImplementation(url => {
      const risk = new URL(url).searchParams.get('riskLevel');
      return Promise.resolve({
        ok: true,
        json: async () => ({
          data: [{
            fundId: `fund-${risk}`,
            routeName: `קרן ${risk}`,
            shortText: 'מנהל',
            yield36Months: 5,
          }],
        }),
      });
    });

    const low = await getLeadingFunds('LOW');
    const high = await getLeadingFunds('HIGH');

    expect(low.funds[0].id).toBe('fund-1');
    expect(high.funds[0].id).toBe('fund-3');
    expect(global.fetch).toHaveBeenCalledTimes(2);

    const lowCached = await getLeadingFunds('LOW');
    expect(lowCached.source).toBe('cache');
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('falls back to cached data for the same risk when Finq fails', async () => {
    await seedCacheForTests('MEDIUM', [{
      id: 'cached-1',
      fundName: 'קרן cache',
      managingBody: 'מגדל',
      yield3Years: 6.1,
      managementFeeAccumulation: 0.12,
      managementFeeDeposit: 1.0,
      sharpeRatio: 0.9,
      riskCategory: 'MEDIUM',
    }]);

    global.fetch.mockRejectedValue(new Error('network down'));

    const result = await getLeadingFunds('MEDIUM', { forceRefresh: true });
    expect(result.source).toBe('cache_fallback');
    expect(result.funds[0].fundName).toBe('קרן cache');
    expect(result.warning).toBeTruthy();
  });

  it('getFundById resolves from risk-scoped cache when Finq fails', async () => {
    await seedCacheForTests('LOW', [{
      id: 'abc-123',
      fundName: 'כלל מקיפה',
      managingBody: 'כלל',
      yield3Years: 4.2,
      managementFeeAccumulation: 0.11,
      managementFeeDeposit: 0.9,
      sharpeRatio: 0.7,
      riskCategory: 'LOW',
    }]);

    global.fetch.mockRejectedValue(new Error('fail'));

    const result = await getFundById('abc-123', { risk: 'LOW' });
    expect(result.source).toBe('cache_fallback');
    expect(result.fund.fundName).toBe('כלל מקיפה');
  });
});
