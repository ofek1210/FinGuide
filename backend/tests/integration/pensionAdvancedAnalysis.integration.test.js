'use strict';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const PensiaNetFund = require('../../models/PensiaNetFund');
const PensionFund = require('../../models/PensionFund');
const PensionDeposit = require('../../models/PensionDeposit');
const UserProfile = require('../../models/UserProfile');
const { runPensionRecommendationEngine } = require('../../services/pensionRecommendationEngine');
const peers = require('../fixtures/pension-advanced/pensianet-peers.json');
const profileFixture = require('../fixtures/pension-advanced/user-profile.json');

describe('pensionRecommendationEngine integration', () => {
  let mongo;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  beforeEach(async () => {
    await Promise.all([
      PensiaNetFund.deleteMany({}),
      PensionFund.deleteMany({}),
      PensionDeposit.deleteMany({}),
      UserProfile.deleteMany({}),
    ]);
    await PensiaNetFund.insertMany(peers);
  });

  it('generates structured insights for user with pension fund', async () => {
    const userId = new mongoose.Types.ObjectId();

    await UserProfile.create({
      user: userId,
      personal: profileFixture.personal,
      retirement: profileFixture.retirement,
      financial: profileFixture.financial,
      employment: profileFixture.employment,
    });

    const fund = await PensionFund.create({
      user: userId,
      fundName: 'מיטב מקיפה כללי',
      fundType: 'pension_comprehensive',
      provider: 'מיטב',
      investmentTrack: 'כללי',
      riskLevel: 'medium',
      currentBalance: 350000,
      monthlyDeposit: 2500,
      managementFeeAccumulation: 0.55,
      managementFeeDeposit: 1.5,
      historicalReturn5Y: 6.2,
      isActive: true,
      insuranceCoverages: [{ coverageType: 'קצבת שארים', monthlyPension: 1500 }],
    });

    await PensionDeposit.create([
      { user: userId, fund: fund._id, salaryMonth: '2025-03', employeeDeposit: 800, employerDeposit: 900 },
      { user: userId, fund: fund._id, salaryMonth: '2025-02', employeeDeposit: 800, employerDeposit: 900 },
      { user: userId, fund: fund._id, salaryMonth: '2025-01', employeeDeposit: 800, employerDeposit: 900 },
      { user: userId, fund: fund._id, salaryMonth: '2024-12', employeeDeposit: 1200, employerDeposit: 1300 },
      { user: userId, fund: fund._id, salaryMonth: '2024-11', employeeDeposit: 1200, employerDeposit: 1300 },
    ]);

    const { insights, meta } = await runPensionRecommendationEngine(userId, {
      summary: { currentAge: 38, retirementAge: 67, grossSalary: 18000 },
    });

    expect(meta.fundCount).toBe(1);
    expect(insights.length).toBeGreaterThan(3);

    const schemaFields = ['id', 'category', 'severity', 'title', 'finding', 'recommendedAction', 'disclaimer'];
    for (const ins of insights) {
      for (const field of schemaFields) {
        expect(ins).toHaveProperty(field);
      }
    }

    expect(insights.some(i => i.category === 'fund_ranking')).toBe(true);
    expect(insights.some(i => i.category === 'survivor_coverage_fit')).toBe(true);
    expect(meta.dataCompleteness.hasMaritalStatus).toBe(true);
  });
});
