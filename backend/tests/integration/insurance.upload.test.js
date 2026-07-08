

const request = require('supertest');
const { createDomainTestHarness } = require('../helpers/domainTestHarness');
const { uploadInsuranceFixture } = require('../helpers/domainImportAssertions');
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
});
