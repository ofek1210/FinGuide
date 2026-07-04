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

  it('buildLeadingFundsUrl includes risk_level query param', () => {
    const url = buildLeadingFundsUrl('HIGH');
    expect(url).toContain('risk_level=HIGH');
    expect(url).toContain('category=COMPERHENSIVE');
    expect(url).toContain('sortBy=yield_3_years');
  });

  it('normalizeFinqFund maps Finq payload to stable DTO', () => {
    const dto = normalizeFinqFund(
      {
        id: 'f1',
        fund_name: 'הפניקס מקיפה',
        manager: 'הפניקס',
        yield_3_years: 8.4,
        mgmt_fee_accumulation: 0.15,
        mgmt_fee_deposit: 1.2,
        sharpe_ratio: 1.05,
      },
      'MEDIUM',
    );
    expect(dto.fundName).toBe('הפניקס מקיפה');
    expect(dto.yield3Years).toBe(8.4);
    expect(dto.sharpeRatio).toBe(1.05);
  });

  it('getLeadingFunds caches per risk level independently', async () => {
    global.fetch.mockImplementation(url => {
      const risk = new URL(url).searchParams.get('risk_level');
      return Promise.resolve({
        ok: true,
        json: async () => ({
          data: [{
            id: `fund-${risk}`,
            fund_name: `קרן ${risk}`,
            manager: 'מנהל',
            yield_3_years: 5,
          }],
        }),
      });
    });

    const low = await getLeadingFunds('LOW');
    const high = await getLeadingFunds('HIGH');

    expect(low.funds[0].id).toBe('fund-LOW');
    expect(high.funds[0].id).toBe('fund-HIGH');
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
