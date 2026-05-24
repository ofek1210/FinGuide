const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const createApp = require('../../app');
const UserProfile = require('../../models/UserProfile');

describe('Recommendations integration', () => {
  let app;
  let mongoServer;
  let token;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    process.env.JWT_SECRET = 'test-secret';
    process.env.JWT_EXPIRE = '7d';
    process.env.MONGODB_URI = mongoServer.getUri();
    process.env.NODE_ENV = 'test';
    await mongoose.connect(mongoServer.getUri());
    app = createApp();
  });

  beforeEach(async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Rec User',
      email: `rec-${Date.now()}-${Math.random()}@test.com`,
      password: 'Test123',
    });
    token = res.body.data.token;
    const userId = res.body.data.user.id;

    await UserProfile.create({
      user: userId,
      personal: { age: 35, childrenCount: 2 },
      assets: { ownsApartment: true, ownsCar: true, hasMortgage: true },
      insurance: {
        hasLifeInsurance: false,
        hasHealthInsurance: false,
        hasDisabilityInsurance: false,
        hasApartmentInsurance: false,
        hasCarInsurance: false,
      },
      employment: { isPrimaryJob: true, expectedMonthlyGross: 20000 },
    });
  });

  afterEach(async () => {
    await Promise.all(Object.values(mongoose.connection.collections).map(c => c.deleteMany({})));
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  });

  it('POST /api/recommendations/run creates recommendations', async () => {
    const res = await request(app)
      .post('/api/recommendations/run')
      .set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.count).toBeGreaterThan(0);
    expect(res.body.data.some(r => r.kind === 'life')).toBe(true);
    expect(res.body.data.some(r => r.kind === 'apartment')).toBe(true);
  });

  it('GET /api/recommendations lists active recommendations', async () => {
    await request(app)
      .post('/api/recommendations/run')
      .set('Authorization', `Bearer ${token}`);
    const res = await request(app)
      .get('/api/recommendations')
      .set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.count).toBeGreaterThan(0);
  });
});
