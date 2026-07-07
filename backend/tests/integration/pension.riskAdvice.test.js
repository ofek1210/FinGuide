

const request = require('supertest');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { MongoMemoryServer } = require('mongodb-memory-server');
const createApp = require('../../app');
const UserProfile = require('../../models/UserProfile');

jest.mock('../../services/aiProviderService', () => ({
  analyzeWithAI: jest.fn().mockResolvedValue('ניתוח פנסיוני לדוגמה.'),
}));

const FIXTURE_XLSX = path.join(__dirname, '../fixtures/har-hakesef/sample-report.xlsx');

describe('Pension risk-advice integration', () => {
  let app;
  let mongoServer;

  const register = async () => {
    const email = `pension-risk-${Date.now()}-${Math.random()}@test.com`;
    const res = await request(app).post('/api/auth/register').send({
      name: 'Risk User',
      email,
      password: 'Test123',
    });
    return { token: res.body?.data?.token };
  };

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    process.env.JWT_SECRET = 'test-secret';
    process.env.JWT_EXPIRE = '7d';
    process.env.MONGODB_URI = mongoServer.getUri();
    process.env.NODE_ENV = 'test';
    await mongoose.connect(mongoServer.getUri());
    app = createApp();
  });

  afterEach(async () => {
    const collections = mongoose.connection.collections;
    await Promise.all(Object.values(collections).map(c => c.deleteMany({})));
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  });

  it('GET /api/pension/risk-advice returns insights after import', async () => {
    const { token } = await register();
    const buffer = fs.readFileSync(FIXTURE_XLSX);

    await request(app)
      .post('/api/pension/upload-file')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', buffer, 'har-kesef-report.xlsx');

    const profile = await UserProfile.findOne({});
    if (profile) {
      profile.personal = { age: 35 };
      await profile.save();
    }

    const res = await request(app)
      .get('/api/pension/risk-advice')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.insights)).toBe(true);
    expect(res.body.data.meta?.healthScore).toBeDefined();
    expect(typeof res.body.data.narrative).toBe('string');
  });
});
