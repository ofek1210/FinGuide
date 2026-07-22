'use strict';

/**
 * Step 5 live audit — real Express app + real MONGODB_URI (PensiaNet/GemelNet in DB).
 * Writes evidence JSON to backend/scripts/audit-output/
 *
 * Run: npx jest tests/integration/step5.liveAudit.test.js --runInBand --testTimeout=120000
 */

const fs = require('fs');
const path = require('path');
const request = require('supertest');
const mongoose = require('mongoose');
const createApp = require('../../app');
const { MARKET_STATUSES } = require('../../services/financialAdvisory/recommendationCards/recommendationCardContract');

const OUT_DIR = path.join(__dirname, '../../scripts/audit-output');
const PENSION_XLSX = path.join(__dirname, '../fixtures/har-hakesef/sample-report.xlsx');

let app;

beforeAll(async () => {
  require('dotenv').config({ path: path.join(__dirname, '../../.env') });
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'audit-jwt-secret-min-10-chars';
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI required for live audit');
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_URI);
  }
  app = createApp();
  fs.mkdirSync(OUT_DIR, { recursive: true });
});

afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
});

function advisorySlice(data) {
  return {
    recommendationEngine: data.recommendationEngine,
    analysisId: data.analysisId,
    productType: data.productType,
    recommendationCards: data.recommendationCards,
    primaryRecommendations: data.primaryRecommendations,
    accountAnalyses: data.accountAnalyses,
    threeCardMeta: data.threeCardMeta,
    dataQuality: data.dataQuality,
    marketData: data.marketData,
    llm: data.llm,
    hasLegacyBenchmark: Boolean(data.benchmark),
    hasLegacyHealthCheck: Boolean(data.healthCheck),
    hasLegacyRecommendations: Boolean(data.recommendations?.length),
    hasLegacyStructuredInsights: Boolean(data.structuredInsights?.length),
  };
}

function assertNoUnmatchedReplacingRanked(data, label) {
  const marketCard = data.recommendationCards?.find(c => c.slot === 'market_comparison');
  if (!marketCard) return;

  const portfolioIsUnmatched = marketCard.status === MARKET_STATUSES.UNMATCHED;
  const rankedAccounts = (data.accountAnalyses || []).filter(a => {
    const card = a.cards?.find(c => c.slot === 'market_comparison');
    return card
      && card.status !== MARKET_STATUSES.UNMATCHED
      && (card.metrics?.userRank != null || card.metrics?.userCombinedScore != null);
  });

  if (rankedAccounts.length && portfolioIsUnmatched) {
    const rankedSummary = rankedAccounts.map(a => {
      const card = a.cards.find(c => c.slot === 'market_comparison');
      return `${a.accountLabel} rank=${card.metrics?.userRank}/${card.metrics?.peerCount} status=${card.status}`;
    }).join('; ');
    throw new Error(
      `${label}: portfolio market card is unmatched but ranked accounts exist: ${rankedSummary}`,
    );
  }
}

function assertCanonicalThreeCardPayload(data, label) {
  expect(data.recommendationEngine).toBe('three_card_v5');
  expect(data.recommendationCards).toHaveLength(3);
  expect(Array.isArray(data.accountAnalyses)).toBe(true);
  expect(data.accountAnalyses.length).toBeGreaterThan(0);
  expect(data.benchmark).toBeUndefined();
  expect(data.healthCheck).toBeUndefined();
  expect(data.marketAdvice).toBeUndefined();
  expect(data.fundAdvice).toBeUndefined();
  expect(data.structuredInsights).toBeUndefined();
  expect(data.recommendations).toBeUndefined();
  expect(data.marketData?.source === 'PENSION_NET' || data.marketData?.source === 'GEMEL_NET').toBe(true);
  assertNoUnmatchedReplacingRanked(data, label);
}

describe('Step 5 live API audit', () => {
  it('GET /api/pension/analysis and /api/gemel/analysis return canonical three_card_v5', async () => {
    const email = `step5-live-${Date.now()}@test.com`;
    const reg = await request(app).post('/api/auth/register').send({
      name: 'Step5 Live Audit',
      email,
      password: 'Test123',
    });
    expect([200, 201]).toContain(reg.statusCode);
    const token = reg.body.data.token;

    const upload = await request(app)
      .post('/api/pension/upload-file')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', PENSION_XLSX, 'audit-pension.xlsx');
    expect(upload.statusCode).toBe(200);
    expect(upload.body.data.benchmark).toBeUndefined();
    expect(upload.body.data.healthCheck).toBeNull();

    await request(app)
      .patch('/api/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({
        personal: { age: 38 },
        retirement: { plannedRetirementAge: 67 },
        financial: { riskTolerance: 'medium' },
      });

    const pensionRes = await request(app)
      .get('/api/pension/analysis')
      .set('Authorization', `Bearer ${token}`);
    expect(pensionRes.statusCode).toBe(200);

    await request(app)
      .post('/api/gemel/funds')
      .set('Authorization', `Bearer ${token}`)
      .send({
        fundName: 'קרן השתלמות Step5 Audit',
        fundType: 'study_fund',
        provider: 'מנורה',
        currentBalance: 92000,
        managementFeeAccumulation: 0.0075,
        managementFeeDeposit: 0.004,
        investmentTrack: 'כללי',
        riskLevel: 'medium',
      });

    const gemelRes = await request(app)
      .get('/api/gemel/analysis')
      .set('Authorization', `Bearer ${token}`);
    expect(gemelRes.statusCode).toBe(200);

    const pensionData = pensionRes.body.data;
    const gemelData = gemelRes.body.data;

    assertCanonicalThreeCardPayload(pensionData, 'pension');
    assertCanonicalThreeCardPayload(gemelData, 'gemel');

    const runtime = {
      auditedAt: new Date().toISOString(),
      USE_THREE_CARD_RECOMMENDATIONS: process.env.USE_THREE_CARD_RECOMMENDATIONS ?? '(unset → enabled)',
      NODE_ENV: process.env.NODE_ENV,
      mongodb: process.env.MONGODB_URI?.replace(/\/\/[^:]+:[^@]+@/, '//***:***@'),
      pensionImportedFunds: upload.body.data?.imported,
      pensionEngine: pensionData.recommendationEngine,
      gemelEngine: gemelData.recommendationEngine,
      checklist: {
        threeCardV5Active: true,
        exactlyThreeCards: true,
        accountAnalyses: true,
        officialMarketData: true,
        noLegacyBenchmark: !pensionData.benchmark && !gemelData.benchmark,
        noUnmatchedReplacingRanked: true,
      },
    };

    fs.writeFileSync(path.join(OUT_DIR, 'runtime-env.json'), JSON.stringify(runtime, null, 2));
    fs.writeFileSync(path.join(OUT_DIR, 'pension-analysis-full.json'), JSON.stringify(pensionRes.body, null, 2));
    fs.writeFileSync(path.join(OUT_DIR, 'gemel-analysis-full.json'), JSON.stringify(gemelRes.body, null, 2));
    fs.writeFileSync(path.join(OUT_DIR, 'pension-advisory-slice.json'), JSON.stringify(advisorySlice(pensionData), null, 2));
    fs.writeFileSync(path.join(OUT_DIR, 'gemel-advisory-slice.json'), JSON.stringify(advisorySlice(gemelData), null, 2));

    fs.writeFileSync(path.join(OUT_DIR, 'portfolio-selection-trace.json'), JSON.stringify({
      pension: pensionData.recommendationCards?.map(c => ({
        slot: c.slot,
        accountId: c.accountId,
        accountLabel: c.accountLabel,
        status: c.status,
        cardOutcome: c.cardOutcome,
        confidence: c.confidence,
        why: c.why,
        portfolioSelection: c.portfolioSelection,
        metrics: c.metrics,
        alternatives: c.alternatives,
      })),
      gemel: gemelData.recommendationCards?.map(c => ({
        slot: c.slot,
        accountId: c.accountId,
        accountLabel: c.accountLabel,
        status: c.status,
        cardOutcome: c.cardOutcome,
        confidence: c.confidence,
        why: c.why,
        portfolioSelection: c.portfolioSelection,
        metrics: c.metrics,
      })),
    }, null, 2));
  });
});
