const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const createApp = require('../../app');
const User = require('../../models/User');

let app;
let mongoServer;

const registerAndLogin = async (emailOverride) => {
  const email = emailOverride || `user-${Date.now()}@test.com`;

  await request(app).post('/api/auth/register').send({
    name: 'Update Email User',
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

describe('Auth update email flow', () => {
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

  it('allows a user to update email when authenticated', async () => {
    const { token, email } = await registerAndLogin();

    const newEmail = `new-${email}`;

    const res = await request(app)
      .patch('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .send({
        email: newEmail,
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data?.user?.email).toBe(newEmail.toLowerCase());

    const loginWithOld = await request(app).post('/api/auth/login').send({
      email,
      password: 'OldPass123',
    });

    expect(loginWithOld.statusCode).toBe(401);

    const loginWithNew = await request(app).post('/api/auth/login').send({
      email: newEmail,
      password: 'OldPass123',
    });

    expect(loginWithNew.statusCode).toBe(200);
    expect(loginWithNew.body.success).toBe(true);
  });

  it('rejects update when email already in use', async () => {
    const existingEmail = 'existing@test.com';

    await User.create({
      name: 'Existing User',
      email: existingEmail,
      password: 'SomePass123',
    });

    const { token } = await registerAndLogin('updater@test.com');

    const res = await request(app)
      .patch('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .send({
        email: existingEmail,
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('משתמש עם אימייל זה כבר קיים');
  });

  it('rejects update when no token is provided', async () => {
    const res = await request(app).patch('/api/auth/me').send({
      email: 'new-no-token@test.com',
    });

    expect(res.statusCode).toBe(401);
  });
});

