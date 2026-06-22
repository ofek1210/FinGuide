'use strict';

const request = require('supertest');
const UserProfile = require('../../models/UserProfile');
const { createDomainTestHarness } = require('../helpers/domainTestHarness');
const { uploadPensionFixture, expectFindingsIncludeKinds } = require('../helpers/domainImportAssertions');
const { buildPensionBenchmarkFindingsForUser } = require('../../utils/detectPensionBenchmark');

describe('Pension findings integration', () => {
  const harness = createDomainTestHarness('pension-findings');

  beforeAll(() => harness.beforeAll());
  afterEach(() => harness.afterEach());
  afterAll(() => harness.afterAll());

  it('GET /api/findings includes pension benchmark kinds after import', async () => {
    const app = harness.getApp();
    const { token, userId } = await harness.register();

    await uploadPensionFixture(app, token);

    await UserProfile.findOneAndUpdate(
      { user: userId },
      { $set: { personal: { age: 35 } } },
      { upsert: true },
    );

    const directFindings = await buildPensionBenchmarkFindingsForUser(userId);
    expect(directFindings.length).toBeGreaterThan(0);

    const res = await request(app)
      .get('/api/findings')
      .set('Authorization', `Bearer ${token}`);

    expectFindingsIncludeKinds(
      res,
      ['fee_above_market', 'risk_wrong_for_age', 'track_underperforming', 'pension_health_low'],
      /דמי ניהול|מסלול סיכון|בריאות פנסיונית|מתחת לממוצע/,
    );
  });
});
