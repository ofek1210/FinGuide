'use strict';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const PensiaNetFund = require('../../models/PensiaNetFund');
const {
  ruleSmallInactivePension,
  ruleHighFeeInactiveProvident,
  generateClearinghouseInsightRecommendations,
} = require('../../services/pensionClearinghouseInsights');

const USER_FIXTURE_ROWS = [
  {
    companyName: 'מיטב גמל ופנסיה בע"מ',
    productName: 'פנסיה חדשה מקיפה',
    productType: 'פנסיה חדשה מקיפה',
    totalSavings: 462.01,
    depositFee: 1.0,
    assetFee: 0.22,
    status: 'לא פעיל',
    isActive: false,
  },
  {
    companyName: 'כלל פנסיה וגמל בע"מ',
    productName: 'פנסיה חדשה מקיפה',
    productType: 'פנסיה חדשה מקיפה',
    totalSavings: 120436.25,
    depositFee: 0.9,
    assetFee: 0.19,
    status: 'פעיל',
    isActive: true,
  },
  {
    companyName: 'הראל פנסיה וגמל בע"מ',
    productName: 'קופת גמל',
    productType: 'קופת גמל',
    totalSavings: 40196.77,
    depositFee: 4.0,
    assetFee: 1.05,
    status: 'לא פעיל',
    isActive: false,
  },
];

describe('pensionClearinghouseInsights', () => {
  let mongoServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    await PensiaNetFund.insertMany([
      {
        ID: '9001',
        SHM_KRN: 'כלל פנסיה מקיפה - כללי',
        SHM_TAAGID_MENAEL: 'כלל פנסיה וגמל בע"מ',
        SUG_KRN: 'קרנות חדשות',
        SHIUR_D_NIHUL_AHARON_HAFKADOT: 0.85,
        SHIUR_D_NIHUL_AHARON_TTVURAH: 0.15,
        TSUA_SHNATIT_MEMUZAAT_5_SHANIM: 5.5,
        BETA_HUTZ_LAARETZ: 30,
      },
    ]);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  it('Rule 1 — small inactive Meitav pension triggers consolidation alert', () => {
    const recs = ruleSmallInactivePension(USER_FIXTURE_ROWS);
    expect(recs).toHaveLength(1);
    expect(recs[0].title).toBe('איחוד קרנות פנסיה');
    expect(recs[0].reason).toMatch(/462\.01/);
    expect(recs[0].reason).toMatch(/כלל/);
  });

  it('Rule 2 — high-fee inactive Harel provident triggers critical alert', () => {
    const recs = ruleHighFeeInactiveProvident(USER_FIXTURE_ROWS);
    expect(recs).toHaveLength(1);
    expect(recs[0].title).toBe('דמי ניהול חריגים בקופה לא פעילה');
    expect(recs[0].reason).toMatch(/40,196\.77/);
    expect(recs[0].reason).toMatch(/1\.05%/);
    expect(recs[0].urgency).toBe('high');
  });

  it('generateClearinghouseInsightRecommendations returns all three rule types', async () => {
    const recs = await generateClearinghouseInsightRecommendations(null, USER_FIXTURE_ROWS);
    const types = recs.map(r => r.type);
    expect(types).toContain('clearinghouse_small_inactive_pension');
    expect(types).toContain('clearinghouse_high_fee_inactive_provident');
    expect(types).toContain('clearinghouse_active_fee_benchmark');
    expect(recs.find(r => r.type === 'clearinghouse_active_fee_benchmark')?.reason).toMatch(/120,436\.25/);
  });
});
