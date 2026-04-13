const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const User = require('../../models/User');
const { hashResetToken } = require('../../services/passwordResetService');

jest.mock('../../services/mailService', () => ({
  sendPasswordResetEmail: jest.fn(),
}));

const { sendPasswordResetEmail } = require('../../services/mailService');
const createApp = require('../../app');

let app;
let mongoServer;

jest.setTimeout(15000);

describe('Auth password reset flow', () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();

    process.env.JWT_SECRET = 'test-secret';
    process.env.JWT_EXPIRE = '7d';
    process.env.MONGODB_URI = mongoUri;
    process.env.NODE_ENV = 'test';
    process.env.CLIENT_URL = 'http://localhost:5173';
    process.env.APP_PUBLIC_URL = 'http://localhost:5173';
    process.env.PASSWORD_RESET_EXPIRE_MINUTES = '15';

    await mongoose.connect(mongoUri);
    app = createApp();
  });

  afterEach(async () => {
    jest.clearAllMocks();
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

  it('returns a generic success and stores reset hash/expiry for existing email', async () => {
    await request(app).post('/api/auth/register').send({
      name: 'Reset User',
      email: 'reset@test.com',
      password: 'OldPass123',
    });

    const res = await request(app).post('/api/auth/forgot-password').send({
      email: 'reset@test.com',
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      success: true,
      message: 'אם החשבון קיים, שלחנו קישור לאיפוס סיסמה.',
    });

    const user = await User.findOne({ email: 'reset@test.com' });
    expect(user.passwordResetTokenHash).toBeTruthy();
    expect(user.passwordResetExpiresAt).toBeInstanceOf(Date);

    expect(sendPasswordResetEmail).toHaveBeenCalledTimes(1);
    const emailArgs = sendPasswordResetEmail.mock.calls[0][0];
    expect(emailArgs.to).toBe('reset@test.com');
    expect(emailArgs.expiresInMinutes).toBe(15);
    expect(emailArgs.resetUrl).toMatch(
      /^http:\/\/localhost:5173\/reset-password\?token=/
    );
    const rawToken = new URL(emailArgs.resetUrl).searchParams.get('token');
    expect(hashResetToken(rawToken)).toBe(user.passwordResetTokenHash);
  });

  it('returns the same generic success for missing email without sending mail', async () => {
    const res = await request(app).post('/api/auth/forgot-password').send({
      email: 'missing@test.com',
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      success: true,
      message: 'אם החשבון קיים, שלחנו קישור לאיפוס סיסמה.',
    });
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('resets password with a valid token and clears reset fields', async () => {
    await request(app).post('/api/auth/register').send({
      name: 'Reset Success User',
      email: 'reset-success@test.com',
      password: 'OldPass123',
    });

    await request(app).post('/api/auth/forgot-password').send({
      email: 'reset-success@test.com',
    });

    const resetUrl = sendPasswordResetEmail.mock.calls[0][0].resetUrl;
    const rawToken = new URL(resetUrl).searchParams.get('token');

    const resetRes = await request(app).post('/api/auth/reset-password').send({
      token: rawToken,
      newPassword: 'NewPass123',
    });

    expect(resetRes.statusCode).toBe(200);
    expect(resetRes.body).toEqual({
      success: true,
      message: 'הסיסמה עודכנה בהצלחה',
    });

    const user = await User.findOne({ email: 'reset-success@test.com' }).select(
      '+password'
    );
    expect(user.passwordResetTokenHash).toBeNull();
    expect(user.passwordResetExpiresAt).toBeNull();

    const loginRes = await request(app).post('/api/auth/login').send({
      email: 'reset-success@test.com',
      password: 'NewPass123',
    });
    expect(loginRes.statusCode).toBe(200);
    expect(loginRes.body.success).toBe(true);
  });

  it('rejects invalid, expired, or missing reset tokens', async () => {
    await request(app).post('/api/auth/register').send({
      name: 'Reset Invalid User',
      email: 'reset-invalid@test.com',
      password: 'OldPass123',
    });

    const invalidRes = await request(app).post('/api/auth/reset-password').send({
      token: 'wrong-token',
      newPassword: 'NewPass123',
    });
    expect(invalidRes.statusCode).toBe(400);
    expect(invalidRes.body.message).toBe('קישור האיפוס לא תקף או שפג תוקפו');

    const missingRes = await request(app).post('/api/auth/reset-password').send({
      newPassword: 'NewPass123',
    });
    expect(missingRes.statusCode).toBe(400);
    expect(missingRes.body.message).toBe('שגיאות בולידציה');

    const user = await User.findOne({ email: 'reset-invalid@test.com' });
    user.passwordResetTokenHash = hashResetToken('expired-token');
    user.passwordResetExpiresAt = new Date(Date.now() - 60 * 1000);
    await user.save();

    const expiredRes = await request(app).post('/api/auth/reset-password').send({
      token: 'expired-token',
      newPassword: 'NewPass123',
    });
    expect(expiredRes.statusCode).toBe(400);
    expect(expiredRes.body.message).toBe('קישור האיפוס לא תקף או שפג תוקפו');
  });

  it('invalidates the previous token when issuing a new reset link', async () => {
    await request(app).post('/api/auth/register').send({
      name: 'Reset Replace User',
      email: 'reset-replace@test.com',
      password: 'OldPass123',
    });

    await request(app).post('/api/auth/forgot-password').send({
      email: 'reset-replace@test.com',
    });
    const firstUrl = sendPasswordResetEmail.mock.calls[0][0].resetUrl;
    const firstToken = new URL(firstUrl).searchParams.get('token');

    await request(app).post('/api/auth/forgot-password').send({
      email: 'reset-replace@test.com',
    });
    const secondUrl = sendPasswordResetEmail.mock.calls[1][0].resetUrl;
    const secondToken = new URL(secondUrl).searchParams.get('token');

    const firstReset = await request(app).post('/api/auth/reset-password').send({
      token: firstToken,
      newPassword: 'NewPass123',
    });
    expect(firstReset.statusCode).toBe(400);

    const secondReset = await request(app).post('/api/auth/reset-password').send({
      token: secondToken,
      newPassword: 'NewPass123',
    });
    expect(secondReset.statusCode).toBe(200);
  });
});
