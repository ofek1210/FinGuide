

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const createApp = require('../../app');

let sharedMongoServer = null;

/**
 * Spin up in-memory Mongo + Express app for domain integration tests.
 */
async function setupDomainTestApp(options = {}) {
  if (options.mockMail) {
    const mail = require('../../services/mailService');
    jest.spyOn(mail, 'sendMail').mockResolvedValue({ messageId: 'test-msg' });
  }
  if (options.mockAi) {
    const ai = require('../../services/aiProviderService');
    jest.spyOn(ai, 'analyzeWithAI').mockResolvedValue(null);
  }

  const mongoServer = await MongoMemoryServer.create();
  process.env.JWT_SECRET = 'test-secret';
  process.env.JWT_EXPIRE = '7d';
  process.env.MONGODB_URI = mongoServer.getUri();
  process.env.NODE_ENV = 'test';
  process.env.SMTP_HOST = 'localhost';
  process.env.SMTP_PORT = '1025';
  process.env.SMTP_USER = 'test';
  process.env.SMTP_PASS = 'test';
  process.env.SMTP_FROM = 'test@finguide.test';
  process.env.SMTP_SECURE = 'false';
  await mongoose.connect(mongoServer.getUri());
  const app = createApp();
  return { app, mongoServer };
}

async function teardownDomainTestApp(mongoServer) {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
}

async function clearAllCollections() {
  const {collections} = mongoose.connection;
  await Promise.all(Object.values(collections).map(c => c.deleteMany({})));
}

/**
 * Register a unique test user and return auth token + userId.
 */
async function registerTestUser(app, prefix = 'domain') {
  const email = `${prefix}-${Date.now()}-${Math.random()}@test.com`;
  const res = await request(app).post('/api/auth/register').send({
    name: 'Test User',
    email,
    password: 'Test123',
  });
  return {
    token: res.body?.data?.token,
    userId: res.body?.data?.user?.id,
    email,
  };
}

/**
 * Shared suite lifecycle — use in beforeAll/afterAll/afterEach.
 */
function createDomainTestHarness(suiteName = 'domain', options = {}) {
  let app;
  let mongoServer;

  return {
    getApp: () => app,
    beforeAll: async () => {
      ({ app, mongoServer } = await setupDomainTestApp(options));
      sharedMongoServer = mongoServer;
    },
    afterEach: clearAllCollections,
    afterAll: async () => {
      await teardownDomainTestApp(mongoServer);
      sharedMongoServer = null;
    },
    register: () => registerTestUser(app, suiteName),
  };
}

module.exports = {
  setupDomainTestApp,
  teardownDomainTestApp,
  clearAllCollections,
  registerTestUser,
  createDomainTestHarness,
};
