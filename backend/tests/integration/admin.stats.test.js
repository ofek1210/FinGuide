const request = require('supertest');
const { createDomainTestHarness } = require('../helpers/domainTestHarness');
const User = require('../../models/User');

describe('Admin stats integration', () => {
  const harness = createDomainTestHarness('admin-stats');

  beforeAll(() => harness.beforeAll());
  afterEach(() => harness.afterEach());
  afterAll(() => harness.afterAll());

  it('rejects unauthenticated requests with 401', async () => {
    const app = harness.getApp();
    const res = await request(app).get('/api/admin/stats');
    expect(res.status).toBe(401);
  });

  it('rejects regular users with 403', async () => {
    const app = harness.getApp();
    const { token } = await harness.register();

    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('returns stats for admin users', async () => {
    const app = harness.getApp();
    const { token, userId } = await harness.register();
    await User.findByIdAndUpdate(userId, { role: 'admin' });

    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const { users, documents, ai } = res.body.data;
    expect(users.total).toBeGreaterThanOrEqual(1);
    expect(users).toHaveProperty('onboardingCompleted');
    expect(users).toHaveProperty('newByDay');
    expect(documents).toHaveProperty('byStatus');
    expect(documents).toHaveProperty('uploadsByDay');
    expect(ai).toHaveProperty('conversations');
    expect(ai).toHaveProperty('totalTokens');
  });

  it('exposes role through GET /api/auth/me', async () => {
    const app = harness.getApp();
    const { token, userId } = await harness.register();

    const before = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(before.body.data.user.role).toBe('user');

    await User.findByIdAndUpdate(userId, { role: 'admin' });

    const after = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(after.body.data.user.role).toBe('admin');
  });
});
