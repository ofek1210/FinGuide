

const request = require('supertest');
const { createDomainTestHarness } = require('../helpers/domainTestHarness');
const { uploadInsuranceFixture } = require('../helpers/domainImportAssertions');
const { buildEmptyHarBituachExcel } = require('../fixtures/buildHarBituachExcel');
const InsurancePolicy = require('../../models/InsurancePolicy');

describe('Insurance upload integration', () => {
  const harness = createDomainTestHarness('insurance');

  beforeAll(() => harness.beforeAll());
  afterEach(() => harness.afterEach());
  afterAll(() => harness.afterAll());

  it('POST /api/insurance/upload-excel returns analysis shape', async () => {
    const app = harness.getApp();
    const { token, userId } = await harness.register();

    const res = await uploadInsuranceFixture(app, token);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.imported).toBeGreaterThan(0);
    expect(res.body.data.healthCheck).toBeTruthy();
    expect(res.body.data.analysis).toBeTruthy();

    const policies = await InsurancePolicy.find({ user: userId });
    expect(policies.length).toBeGreaterThan(0);
  });

  it('GET /api/insurance/analysis returns healthCheck after import', async () => {
    const app = harness.getApp();
    const { token } = await harness.register();

    await uploadInsuranceFixture(app, token);

    const res = await request(app)
      .get('/api/insurance/analysis')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.healthCheck).toBeTruthy();
    expect(res.body.data.summary.hasData).toBe(true);
  });

  it('re-import replaces stale har_bituach policies', async () => {
    const app = harness.getApp();
    const { token, userId } = await harness.register();

    await uploadInsuranceFixture(app, token, 'first.xlsx');
    await uploadInsuranceFixture(app, token, 'second.xlsx');

    const policies = await InsurancePolicy.find({ user: userId, source: 'har_bituach' });
    expect(policies.length).toBeGreaterThan(0);
    expect(policies.every(p => p.sourceFile === 'second.xlsx')).toBe(true);
  });

  it('re-uploading the same Excel file succeeds (refresh, not 409)', async () => {
    const app = harness.getApp();
    const { token, userId } = await harness.register();

    const first = await uploadInsuranceFixture(app, token, 'same-report.xlsx');
    expect(first.statusCode).toBe(200);

    const second = await uploadInsuranceFixture(app, token, 'same-report.xlsx');
    expect(second.statusCode).toBe(200);
    expect(second.body.success).toBe(true);

    const policies = await InsurancePolicy.find({ user: userId, source: 'har_bituach' });
    expect(policies.length).toBeGreaterThan(0);
  });

  it('accepts a valid empty Har HaBituach report and unlocks onboarding', async () => {
    const app = harness.getApp();
    const { token } = await harness.register();

    const uploadRes = await request(app)
      .post('/api/insurance/upload-excel')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', buildEmptyHarBituachExcel(), 'empty-har-bituach.xlsx');

    expect(uploadRes.statusCode).toBe(200);
    expect(uploadRes.body.data.imported).toBe(0);

    const sessionRes = await request(app)
      .get('/api/insurance/onboarding/session')
      .set('Authorization', `Bearer ${token}`);

    expect(sessionRes.statusCode).toBe(200);
    expect(sessionRes.body.data.ready).toBe(true);
    expect(sessionRes.body.data.reportProfile.policyCount).toBe(0);
    expect(sessionRes.body.data.questions.length).toBeGreaterThan(0);
  });

  it('accepts onboarding answers that arrive as double-encoded JSON', async () => {
    const app = harness.getApp();
    const { token } = await harness.register();

    await request(app)
      .post('/api/insurance/upload-excel')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', buildEmptyHarBituachExcel(), 'empty-har-bituach.xlsx')
      .expect(200);

    const sessionRes = await request(app)
      .get('/api/insurance/onboarding/session')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const questionId = sessionRes.body.data.currentQuestion.id;
    const answerRes = await request(app)
      .post('/api/insurance/onboarding/answer')
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ questionId, value: false, skipped: false }));

    expect(answerRes.statusCode).toBe(200);
    expect(answerRes.body.data.currentQuestion.id).not.toBe(questionId);
  });
});
