'use strict';

/**
 * One-off script: print prioritized pension recommendations JSON for fixture user.
 * Usage: node scripts/print-pension-recommendations.js
 */
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const PensiaNetFund = require('../models/PensiaNetFund');
const PensionFund = require('../models/PensionFund');
const PensionDeposit = require('../models/PensionDeposit');
const UserProfile = require('../models/UserProfile');
const { buildPensionAnalysis } = require('../services/pensionAnalysisService');
const peers = require('../tests/fixtures/pension-advanced/pensianet-peers.json');
const profileFixture = require('../tests/fixtures/pension-advanced/user-profile.json');

async function main() {
  const mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());

  try {
    await PensiaNetFund.insertMany(peers);
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
    ]);

    const analysis = await buildPensionAnalysis(userId, { skipLLM: true });

    const stats = analysis.prioritizationStats || {};
    const output = {
      llm: analysis.llm,
      prioritizationStats: stats,
      primaryRecommendations: analysis.primaryRecommendations,
      positiveFindings: analysis.positiveFindings?.map(p => ({ id: p.id, title: p.title, finding: p.finding })),
      additionalInsights: analysis.additionalInsights?.map(p => ({ id: p.id, title: p.title, finding: p.finding })),
      legacyRecommendationsCount: analysis.recommendations?.length ?? 0,
      structuredInsightsCount: analysis.structuredInsights?.length ?? 0,
    };

    console.log(JSON.stringify(output, null, 2));
  } finally {
    await mongoose.disconnect();
    await mongo.stop();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
