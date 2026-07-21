'use strict';

jest.mock('../../services/harHaBituachService', () => ({
  parseHarHaBituach: jest.fn(),
  isHarHaBituachBuffer: jest.fn().mockReturnValue(false),
}));

const request = require('supertest');
const { createDomainTestHarness } = require('../helpers/domainTestHarness');

describe('Smart onboarding API', () => {
  const harness = createDomainTestHarness('smart-onboarding');

  beforeAll(() => harness.beforeAll());
  afterEach(async () => harness.afterEach());
  afterAll(() => harness.afterAll());

  it('GET /api/smart-onboarding/general returns missing questions for new user', async () => {
    const { token } = await harness.register();
    const res = await request(harness.getApp())
      .get('/api/smart-onboarding/general')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.missingQuestions.length).toBeGreaterThan(0);
    expect(res.body.data.complete).toBe(false);
  });

  it('POST /api/smart-onboarding/general/complete completes onboarding', async () => {
    const { token } = await harness.register();
    const answers = {
      'general.age': 33,
      'general.maritalStatus': 'single',
      'general.hasChildren': false,
      'general.employmentStatus': 'employee',
      'general.financialGoals': ['understand_finances'],
      'general.investmentExperience': 'none',
      'general.riskTolerance': 'low',
    };
    const res = await request(harness.getApp())
      .post('/api/smart-onboarding/general/complete')
      .set('Authorization', `Bearer ${token}`)
      .send({ answers });
    expect(res.status).toBe(200);
    expect(res.body.data.complete).toBe(true);
  });

  it('GET /api/smart-onboarding/agents/payslip skips known profile fields', async () => {
    const { token, userId } = await harness.register();
    const UserProfile = require('../../models/UserProfile');
    const profile = await UserProfile.findOrCreateForUser(userId);
    profile.employment = { isPrimaryJob: true, hasMultipleEmployers: false };
    await profile.save();

    const res = await request(harness.getApp())
      .get('/api/smart-onboarding/agents/payslip')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.missingQuestions.find(q => q.id === 'payslip.onlyEmployer')).toBeUndefined();
  });

  it('POST /api/smart-onboarding/agents/gemel/complete persists agent answers', async () => {
    const { token } = await harness.register();
    const res = await request(harness.getApp())
      .post('/api/smart-onboarding/agents/gemel/complete')
      .set('Authorization', `Bearer ${token}`)
      .send({
        answers: {
          'gemel.moneyPurpose': 'general_savings',
          'gemel.liquidityHorizon': '5_10_years',
          'gemel.returnVsStability': 'balance',
          'gemel.lossReaction': 'not_sure',
          'gemel.wantAlternatives': true,
        },
      });
    expect(res.status).toBe(200);
    expect(res.body.data.complete).toBe(true);
  });

  it('POST /api/smart-onboarding/agents/payslip/skip stops modal from reappearing', async () => {
    const { token } = await harness.register();
    const skipRes = await request(harness.getApp())
      .post('/api/smart-onboarding/agents/payslip/skip')
      .set('Authorization', `Bearer ${token}`);
    expect(skipRes.status).toBe(200);
    expect(skipRes.body.data.skipped).toBe(true);
    expect(skipRes.body.data.shouldShowModal).toBe(false);

    const stateRes = await request(harness.getApp())
      .get('/api/smart-onboarding/agents/payslip')
      .set('Authorization', `Bearer ${token}`);
    expect(stateRes.status).toBe(200);
    expect(stateRes.body.data.shouldShowModal).toBe(false);
  });
});
