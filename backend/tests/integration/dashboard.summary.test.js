

const request = require('supertest');
const fs = require('fs');
const path = require('path');
const { createDomainTestHarness } = require('../helpers/domainTestHarness');
const { buildHarBituachExcel } = require('../fixtures/buildHarBituachExcel');
const UserProfile = require('../../models/UserProfile');

const PENSION_FIXTURE = path.join(__dirname, '../fixtures/har-hakesef/sample-report.xlsx');

describe('Dashboard summary integration', () => {
  const harness = createDomainTestHarness('dashboard-summary');

  beforeAll(() => harness.beforeAll());
  afterEach(() => harness.afterEach());
  afterAll(() => harness.afterAll());

  it('GET /api/dashboard/summary returns analysis-based scores after pension + insurance import', async () => {
    const app = harness.getApp();
    const { token, userId } = await harness.register();
    const pensionBuffer = fs.readFileSync(PENSION_FIXTURE);
    const insuranceBuffer = buildHarBituachExcel();

    await request(app)
      .post('/api/pension/upload-file')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', pensionBuffer, 'har-kesef-report.xlsx');

    await UserProfile.findOneAndUpdate(
      { user: userId },
      { $set: { 'personal.age': 35, 'retirement.plannedRetirementAge': 67 } },
      { upsert: true },
    );

    await request(app)
      .post('/api/insurance/upload-excel')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', insuranceBuffer, 'har-bituach.xlsx');

    const res = await request(app)
      .get('/api/dashboard/summary')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.scores.pension).not.toBeNull();
    expect(res.body.data.scores.insurance).not.toBeNull();
    expect(typeof res.body.data.scores.pension).toBe('number');
    expect(typeof res.body.data.scores.insurance).toBe('number');
    expect(res.body.data.scores.overall).not.toBeNull();
    expect(res.body.data.profile.hasPensionData).toBe(true);
    expect(res.body.data.profile.hasInsuranceData).toBe(true);
    expect(res.body.data.profile.importedPolicies).toBeGreaterThan(0);
  });
});
