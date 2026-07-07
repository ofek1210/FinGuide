

const request = require('supertest');
const { createDomainTestHarness } = require('../helpers/domainTestHarness');
const { uploadInsuranceFixture, expectFindingsIncludeKinds } = require('../helpers/domainImportAssertions');
const { buildInsuranceBenchmarkFindingsForUser } = require('../../utils/detectInsuranceBenchmark');

describe('Insurance findings integration', () => {
  const harness = createDomainTestHarness('insurance-findings');

  beforeAll(() => harness.beforeAll());
  afterEach(() => harness.afterEach());
  afterAll(() => harness.afterAll());

  it('GET /api/findings includes insurance benchmark kinds after import', async () => {
    const app = harness.getApp();
    const { token, userId } = await harness.register();

    await uploadInsuranceFixture(app, token);

    const directFindings = await buildInsuranceBenchmarkFindingsForUser(userId);
    expect(directFindings.length).toBeGreaterThan(0);

    const res = await request(app)
      .get('/api/findings')
      .set('Authorization', `Bearer ${token}`);

    expectFindingsIncludeKinds(
      res,
      ['insurance_health_low', 'insurance_duplicate', 'insurance_missing_coverage'],
      /ביטוח|כפילות|כיסוי/,
    );
  });
});
