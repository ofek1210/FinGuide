

const request = require('supertest');
const fs = require('fs');
const path = require('path');
const { createDomainTestHarness } = require('../helpers/domainTestHarness');
const PensionFund = require('../../models/PensionFund');
const UserProfile = require('../../models/UserProfile');

const FIXTURE_XLSX = path.join(__dirname, '../fixtures/har-hakesef/sample-report.xlsx');

describe('Pension Har HaKesef upload integration', () => {
  const harness = createDomainTestHarness('pension');

  beforeAll(() => harness.beforeAll());
  afterEach(() => harness.afterEach());
  afterAll(() => harness.afterAll());

  it('POST /api/pension/upload-file imports Excel funds', async () => {
    const app = harness.getApp();
    const { token, userId } = await harness.register();
    const buffer = fs.readFileSync(FIXTURE_XLSX);

    const res = await request(app)
      .post('/api/pension/upload-file')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', buffer, 'har-kesef-report.xlsx');

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.imported).toBe(4);

    const funds = await PensionFund.find({ user: userId });
    expect(funds).toHaveLength(4);
    expect(funds.every(f => f.source === 'har_hakesef')).toBe(true);

    const profile = await UserProfile.findOne({ user: userId });
    expect(profile.retirement.currentPensionAccumulation).toBe(400000);
    expect(profile.retirement.hasStudyFund).toBe(true);
  });

  it('GET /api/pension/analysis returns data after import', async () => {
    const app = harness.getApp();
    const { token, userId } = await harness.register();
    const buffer = fs.readFileSync(FIXTURE_XLSX);

    await request(app)
      .post('/api/pension/upload-file')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', buffer, 'har-kesef-report.xlsx');

    await UserProfile.findOneAndUpdate(
      { user: userId },
      { $set: { 'personal.age': 35, 'retirement.plannedRetirementAge': 67 } },
    );

    const res = await request(app)
      .get('/api/pension/analysis')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.summary.hasData).toBe(true);
    expect(res.body.data.healthCheck).toBeTruthy();
    expect(res.body.data.benchmark).toBeTruthy();
  });

  it('re-import replaces stale har_hakesef funds', async () => {
    const app = harness.getApp();
    const { token, userId } = await harness.register();
    const buffer = fs.readFileSync(FIXTURE_XLSX);

    await request(app)
      .post('/api/pension/upload-file')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', buffer, 'first.xlsx');

    await request(app)
      .post('/api/pension/upload-file')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', buffer, 'second.xlsx');

    const funds = await PensionFund.find({ user: userId, source: 'har_hakesef' });
    expect(funds).toHaveLength(4);
    expect(funds.every(f => f.sourceFile === 'second.xlsx')).toBe(true);
  });

  it('manual fund is not deleted on re-import', async () => {
    const app = harness.getApp();
    const { token, userId } = await harness.register();
    const buffer = fs.readFileSync(FIXTURE_XLSX);

    await PensionFund.create({
      user: userId,
      fundName: 'קרן ידנית',
      fundType: 'pension_comprehensive',
      source: 'manual',
      status: 'active',
      isActive: true,
    });

    await request(app)
      .post('/api/pension/upload-file')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', buffer, 'import.xlsx');

    const manual = await PensionFund.findOne({ user: userId, source: 'manual' });
    expect(manual).toBeTruthy();
    expect(manual.fundName).toBe('קרן ידנית');
  });

  it('GET /api/pension/import-history returns snapshot after upload', async () => {
    const app = harness.getApp();
    const { token } = await harness.register();
    const buffer = fs.readFileSync(FIXTURE_XLSX);

    await request(app)
      .post('/api/pension/upload-file')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', buffer, 'har-kesef-report.xlsx');

    const res = await request(app)
      .get('/api/pension/import-history')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].fundCount).toBe(4);
  });
});
