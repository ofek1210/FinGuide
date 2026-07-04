'use strict';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const PensiaNetFund = require('../../models/PensiaNetFund');
const {
  comparePensionProducts,
  filterPensionProducts,
  project30YearLoss,
} = require('../../services/pensionComparisonEngine');

const MARKET_FIXTURE = [
  {
    ID: '1001',
    SHM_KRN: 'כלל פנסיה מקיפה - כללי',
    SHM_TAAGID_MENAEL: 'כלל פנסיה וגמל בע"מ',
    SUG_KRN: 'קרנות חדשות',
    SHIUR_D_NIHUL_AHARON_HAFKADOT: 0.85,
    SHIUR_D_NIHUL_AHARON_TTVURAH: 0.15,
    SHIUR_D_NIHUL_MEANUAL: 0.15,
    TSUA_SHNATIT_MEMUZAAT_5_SHANIM: 5.5,
    BETA_HUTZ_LAARETZ: 30,
  },
  {
    ID: '1002',
    SHM_KRN: 'כלל פנסיה מקיפה - עוקב מדדי מניות',
    SHM_TAAGID_MENAEL: 'כלל פנסיה וגמל בע"מ',
    SUG_KRN: 'קרנות חדשות',
    SHIUR_D_NIHUL_AHARON_HAFKADOT: 0.9,
    SHIUR_D_NIHUL_AHARON_TTVURAH: 0.18,
    TSUA_SHNATIT_MEMUZAAT_5_SHANIM: 8.2,
    BETA_HUTZ_LAARETZ: 55,
  },
  {
    ID: '1003',
    SHM_KRN: 'מגדל פנסיה מקיפה - עוקב מדדי מניות',
    SHM_TAAGID_MENAEL: 'מגדל גמל ופנסיה בע"מ',
    SUG_KRN: 'קרנות חדשות',
    SHIUR_D_NIHUL_AHARON_HAFKADOT: 0.95,
    SHIUR_D_NIHUL_AHARON_TTVURAH: 0.17,
    TSUA_SHNATIT_MEMUZAAT_5_SHANIM: 9.5,
    BETA_HUTZ_LAARETZ: 60,
  },
];

describe('pensionComparisonEngine', () => {
  let mongoServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await PensiaNetFund.deleteMany({});
    await PensiaNetFund.insertMany(MARKET_FIXTURE);
  });

  it('filterPensionProducts keeps only active pension rows', () => {
    const rows = filterPensionProducts([
      { 'שם מוצר': 'פנסיה חדשה מקיפה', 'סוג מוצר': 'פנסיה', 'שם חברה מנהלת': 'כלל', 'סטטוס': 'פעיל', 'סך הכל חיסכון': 100000, 'שיעור דמי ניהול מהפקדות': 1.2, 'שיעור דמי ניהול שנתי מחיסכון צבור': 0.2 },
      { 'שם מוצר': 'קרן השתלמות', 'סוג מוצר': 'שתלמות', 'סטטוס': 'פעיל', 'סך הכל חיסכון': 5000 },
      { 'שם מוצר': 'פנסיה ישנה', 'סוג מוצר': 'פנסיה', 'סטטוס': 'לא פעיל', 'סך הכל חיסכון': 1000 },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].productName).toBe('פנסיה חדשה מקיפה');
    expect(rows[0].depositFee).toBe(1.2);
  });

  it('project30YearLoss returns positive loss for excess fees', () => {
    const loss = project30YearLoss(120000, 0.5);
    expect(loss).toBeGreaterThan(0);
  });

  it('comparePensionProducts flags high fees and switch alternatives', async () => {
    const result = await comparePensionProducts([
      {
        'שם מוצר': 'פנסיה חדשה מקיפה',
        'סוג מוצר': 'פנסיה חדשה מקיפה',
        'שם חברה מנהלת': 'כלל פנסיה וגמל בע"מ',
        'סטטוס': 'פעיל',
        'סך הכל חיסכון': 120436.25,
        'שיעור דמי ניהול מהפקדות': 1.25,
        'שיעור דמי ניהול שנתי מחיסכון צבור': 0.25,
      },
    ]);

    expect(result.totalPensionSavings).toBe(120436.25);
    expect(result.pensionInsights).toHaveLength(1);

    const insight = result.pensionInsights[0];
    expect(insight.fundName).toBe('פנסיה חדשה מקיפה');
    expect(insight.isPayingTooMuch).toBe(true);
    expect(insight.feeDifference.deposit).toBeGreaterThan(0);
    expect(insight.projected30YearLoss).toBeGreaterThan(0);
    expect(insight.recommendations.feeInsight).toMatch(/דמי ניהול גבוהים/);
    expect(insight.recommendations.returnInsight).toBeTruthy();
  });

  it('throws when no pension products in input', async () => {
    await expect(comparePensionProducts([
      { 'שם מוצר': 'קופת גמל', 'סוג מוצר': 'גמל', 'סטטוס': 'פעיל' },
    ])).rejects.toMatchObject({ statusCode: 400 });
  });
});
