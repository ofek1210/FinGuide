'use strict';

const request = require('supertest');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { MongoMemoryServer } = require('mongodb-memory-server');
const createApp = require('../../app');
const PensionFund = require('../../models/PensionFund');

const FIXTURE_TXT = path.join(__dirname, '../fixtures/har-hakesef/sample-quarterly-report.txt');

describe('Pension quarterly report upload integration', () => {
  let app;
  let mongoServer;

  const register = async () => {
    const email = `pension-q-${Date.now()}-${Math.random()}@test.com`;
    const res = await request(app).post('/api/auth/register').send({
      name: 'Quarterly User',
      email,
      password: 'Test123',
    });
    return { token: res.body?.data?.token, userId: res.body?.data?.user?.id };
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

  it('POST /api/pension/upload-file?importSource=quarterly_report imports text report', async () => {
    const { token, userId } = await register();
    const buffer = fs.readFileSync(FIXTURE_TXT);

    const res = await request(app)
      .post('/api/pension/upload-file?importSource=quarterly_report')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', buffer, 'quarterly-report.txt');

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.imported).toBeGreaterThan(0);

    const funds = await PensionFund.find({ user: userId });
    expect(funds.length).toBeGreaterThan(0);
    expect(funds.some(f => f.source === 'quarterly_report')).toBe(true);
  });
});
