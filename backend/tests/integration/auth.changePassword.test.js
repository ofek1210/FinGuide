const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const createApp = require('../../app');

let app;
let mongoServer;

const registerAndLogin = async () => {
  const email = `user-${Date.now()}@test.com`;

  await request(app).post('/api/auth/register').send({
    name: 'Change Password User',
    email,
    password: 'OldPass123',
  });

  const loginRes = await request(app).post('/api/auth/login').send({
    email,
    password: 'OldPass123',
  });

  return {
    token: loginRes.body?.data?.token,
    email,
  };
};

describe('Auth change password flow', () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();

    process.env.JWT_SECRET = 'test-secret';
    process.env.JWT_EXPIRE = '7d';
    process.env.MONGODB_URI = mongoUri;
    process.env.NODE_ENV = 'test';

    await mongoose.connect(mongoUri);
    app = createApp();
  });

  afterEach(async () => {
    const collections = mongoose.connection.collections;
    await Promise.all(
      Object.values(collections).map(collection => collection.deleteMany({}))
    );
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  it('allows a user to change password with correct current password', async () => {
    const { token, email } = await registerAndLogin();

    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({
        currentPassword: 'OldPass123',
        newPassword: 'NewPass123',
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);

    const loginWithNew = await request(app).post('/api/auth/login').send({
      email,
      password: 'NewPass123',
    });

    expect(loginWithNew.statusCode).toBe(200);
    expect(loginWithNew.body.success).toBe(true);
    expect(loginWithNew.body?.data?.token).toBeTruthy();
  });

  it('rejects change when current password is wrong', async () => {
    const { token } = await registerAndLogin();

    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({
        currentPassword: 'WrongPass123',
        newPassword: 'NewPass123',
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('סיסמה נוכחית שגויה');
  });

  it('rejects change when current password is missing', async () => {
    const { token } = await registerAndLogin();

    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({
        newPassword: 'NewPass123',
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('שגיאות בולידציה');
    expect(
      Array.isArray(res.body.errors)
      && res.body.errors.some(
        error => error.field === 'currentPassword' && error.message === 'סיסמה נוכחית היא שדה חובה'
      )
    ).toBe(true);
  });

  it('rejects change when no token is provided', async () => {
    const res = await request(app).post('/api/auth/change-password').send({
      currentPassword: 'OldPass123',
      newPassword: 'NewPass123',
    });

    expect(res.statusCode).toBe(401);
  });
});
