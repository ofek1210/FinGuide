'use strict';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { mapApiRecordToPensiaNet } = require('../../utils/pensiaNetFieldMapper');
const {
  pickLatestPerFund,
  updateDatabase,
} = require('../../services/pensiaNetIngestionService');
const {
  runFeeChecker,
  filterByRiskPreference,
  hasActuarialBonus,
  buildPensionRecommendations,
} = require('../../services/pensionRecommendationService');
const PensiaNetFund = require('../../models/PensiaNetFund');
const sampleApi = require('../fixtures/pensianet-sample-api.json');

describe('pensiaNetFieldMapper', () => {
  it('maps CKAN record to PensiaNet XML field names', () => {
    const row = sampleApi.result.records[0];
    const mapped = mapApiRecordToPensiaNet(row);

    expect(mapped.ID).toBe('1560');
    expect(mapped.SHM_KRN).toContain('מיטב');
    expect(mapped.SHIUR_D_NIHUL_AHARON_HAFKADOT).toBe(1.39);
    expect(mapped.TSUA_SHNATIT_MEMUZAAT_5_SHANIM).toBe(4.33);
    expect(mapped.BETA_HUTZ_LAARETZ).toBe(11.04);
    expect(mapped.TKUFAT_DUACH).toBe(202401);
  });
});

describe('pensiaNetIngestionService', () => {
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
  });

  it('pickLatestPerFund keeps highest REPORT_PERIOD per FUND_ID', () => {
    const latest = pickLatestPerFund(sampleApi.result.records);
    expect(latest).toHaveLength(1);
    expect(latest[0].TKUFAT_DUACH).toBe(202402);
  });

  it('updateDatabase upserts mapped funds', async () => {
    const funds = pickLatestPerFund(sampleApi.result.records);
    const stats = await updateDatabase(funds);
    expect(stats.total).toBe(1);

    const saved = await PensiaNetFund.findOne({ ID: '1560' }).lean();
    expect(saved.SHM_KRN).toContain('מיטב');
    expect(saved.SHIUR_D_NIHUL_AHARON_HAFKADOT).toBe(1.39);
  });
});

describe('pensionRecommendationService', () => {
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
    await PensiaNetFund.insertMany([
      {
        ID: '100',
        SHM_KRN: 'קרן נוכחית כללית',
        SHM_TAAGID_MENAEL: 'כלל',
        SHIUR_D_NIHUL_AHARON_HAFKADOT: 1.5,
        TSUA_SHNATIT_MEMUZAAT_5_SHANIM: 5.0,
        STIAT_TEKEN_36_HODASHIM: 4.0,
        SHARPE_RATIO: 0.7,
        BETA_HUTZ_LAARETZ: 20,
        ODEF_GIRAON_ACTUARI_LETKUFA: null,
      },
      {
        ID: '200',
        SHM_KRN: 'קרן מניות גבוהה',
        SHM_TAAGID_MENAEL: 'מגדל',
        SHIUR_D_NIHUL_AHARON_HAFKADOT: 1.0,
        TSUA_SHNATIT_MEMUZAAT_5_SHANIM: 8.5,
        STIAT_TEKEN_36_HODASHIM: 9.0,
        SHARPE_RATIO: 1.1,
        BETA_HUTZ_LAARETZ: 55,
        ODEF_GIRAON_ACTUARI_LETKUFA: 0.4,
      },
      {
        ID: '300',
        SHM_KRN: 'קרן סולידית 2030',
        SHM_TAAGID_MENAEL: 'הראל',
        SHIUR_D_NIHUL_AHARON_HAFKADOT: 0.9,
        TSUA_SHNATIT_MEMUZAAT_5_SHANIM: 4.2,
        STIAT_TEKEN_36_HODASHIM: 2.5,
        SHARPE_RATIO: 0.9,
        BETA_HUTZ_LAARETZ: 5,
        ODEF_GIRAON_ACTUARI_LETKUFA: null,
      },
      {
        ID: '400',
        SHM_KRN: 'קרן מאוזנת 2048',
        SHM_TAAGID_MENAEL: 'הפניקס',
        SHIUR_D_NIHUL_AHARON_HAFKADOT: 1.1,
        TSUA_SHNATIT_MEMUZAAT_5_SHANIM: 6.8,
        STIAT_TEKEN_36_HODASHIM: 5.5,
        SHARPE_RATIO: 0.85,
        BETA_HUTZ_LAARETZ: 30,
        ODEF_GIRAON_ACTUARI_LETKUFA: null,
      },
    ]);
  });

  it('Engine A flags overpaying deposit fees', () => {
    const fee = runFeeChecker(
      { SHIUR_D_NIHUL_AHARON_HAFKADOT: 1.5 },
      2.27,
    );
    expect(fee.isPayingTooMuch).toBe(true);
    expect(fee.difference).toBe(0.77);
    expect(fee.currentFundAverage).toBe(1.5);
  });

  it('Engine B filters high-risk equity funds', () => {
    const all = [
      { ID: '1', SHM_KRN: 'מניות', BETA_HUTZ_LAARETZ: 10, TSUA_SHNATIT_MEMUZAAT_5_SHANIM: 1 },
      { ID: '2', SHM_KRN: 'אג"ח', BETA_HUTZ_LAARETZ: 60, TSUA_SHNATIT_MEMUZAAT_5_SHANIM: 2 },
    ];
    const filtered = filterByRiskPreference(all, 'high');
    expect(filtered).toHaveLength(2);
  });

  it('Engine C detects actuarial bonus', () => {
    expect(hasActuarialBonus({ ODEF_GIRAON_ACTUARI_LETKUFA: 0.3 })).toBe(true);
    expect(hasActuarialBonus({ ODEF_GIRAON_ACTUARI_LETKUFA: -0.1 })).toBe(false);
  });

  it('buildPensionRecommendations returns feeAnalysis + top 3 funds', async () => {
    const result = await buildPensionRecommendations({
      currentFundId: '100',
      userManagementFee: 2.27,
      riskPreference: 'high',
    });

    expect(result.feeAnalysis.isPayingTooMuch).toBe(true);
    expect(result.feeAnalysis.difference).toBe(0.77);
    expect(result.recommendedFunds.length).toBeLessThanOrEqual(3);
    expect(result.recommendedFunds[0]).toMatchObject({
      id: expect.any(String),
      fundName: expect.any(String),
      companyName: expect.any(String),
      recommendationReason: expect.any(String),
    });

    const withBonus = result.recommendedFunds.find(f => f.id === '200');
    if (withBonus) {
      expect(withBonus.actuarialBonus).toBe(true);
    }
  });

  it('throws NotFoundError for unknown fund id', async () => {
    await expect(buildPensionRecommendations({
      currentFundId: '99999',
      userManagementFee: 1.5,
      riskPreference: 'medium',
    })).rejects.toMatchObject({ statusCode: 404 });
  });
});
