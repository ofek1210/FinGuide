const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const createApp = require('../../app');
const User = require('../../models/User');
const UserProfile = require('../../models/UserProfile');

describe('Onboarding integration', () => {
  let app;
  let mongoServer;

  const register = async (email = `ob-${Date.now()}-${Math.random()}@test.com`) => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Onboarding User',
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

  it('GET /api/onboarding creates an empty profile when none exists', async () => {
    const { token } = await register();
    const res = await request(app)
      .get('/api/onboarding')
      .set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.completed).toBe(false);
    expect(res.body.data.data.personal).toBeDefined();
    expect(res.body.data.data.employment).toBeDefined();
    expect(res.body.data.data.insurance).toBeDefined();
  });

  it('PUT /api/onboarding saves a sectioned draft', async () => {
    const { token } = await register();
    const res = await request(app)
      .put('/api/onboarding')
      .set('Authorization', `Bearer ${token}`)
      .send({
        data: {
          personal: { age: 32, maritalStatus: 'married', childrenCount: 2 },
          assets: { ownsCar: true, ownsApartment: false, hasMortgage: false },
        },
      });
    expect(res.statusCode).toBe(200);
    expect(res.body.data.data.personal.age).toBe(32);
    expect(res.body.data.data.assets.ownsCar).toBe(true);
  });

  it('PUT /api/onboarding accepts a legacy flat patch and normalizes it', async () => {
    const { token } = await register();
    const res = await request(app)
      .put('/api/onboarding')
      .set('Authorization', `Bearer ${token}`)
      .send({
        data: {
          salaryType: 'global',
          expectedMonthlyGross: 21000,
          hasPension: true,
          hasStudyFund: false,
        },
      });
    expect(res.statusCode).toBe(200);
    expect(res.body.data.data.employment.salaryType).toBe('global');
    expect(res.body.data.data.employment.expectedMonthlyGross).toBe(21000);
    expect(res.body.data.data.retirement.hasPension).toBe(true);
    expect(res.body.data.data.retirement.hasStudyFund).toBe(false);
  });

  it('PUT /api/onboarding rejects out-of-range values', async () => {
    const { token } = await register();
    const res = await request(app)
      .put('/api/onboarding')
      .set('Authorization', `Bearer ${token}`)
      .send({ data: { personal: { age: 5 } } });
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(Array.isArray(res.body.errors)).toBe(true);
  });

  it('POST /api/onboarding/complete fails when required fields are missing', async () => {
    const { token } = await register();
    const res = await request(app)
      .post('/api/onboarding/complete')
      .set('Authorization', `Bearer ${token}`)
      .send({ data: { personal: { age: 30 } } });
    expect(res.statusCode).toBe(400);
    expect(res.body.errors.some(e => e.field === 'personal.maritalStatus')).toBe(true);
  });

  it('POST /api/onboarding/complete succeeds with full data and flips User flag', async () => {
    const { token, userId } = await register();
    const completePayload = {
      data: {
        personal: { age: 30, maritalStatus: 'married', childrenCount: 1 },
        employment: {
          salaryType: 'global',
          expectedMonthlyGross: 22000,
          jobPercentage: 100,
          isPrimaryJob: true,
          hasMultipleEmployers: false,
          employmentStartDate: '2020-01-01',
        },
        retirement: { hasPension: true, hasStudyFund: true },
        assets: { ownsCar: true, ownsApartment: false, hasMortgage: false },
        insurance: { hasLifeInsurance: false, hasHealthInsurance: true },
      },
    };
    const res = await request(app)
      .post('/api/onboarding/complete')
      .set('Authorization', `Bearer ${token}`)
      .send(completePayload);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.completed).toBe(true);

    const dbUser = await User.findById(userId);
    expect(dbUser.onboarding.completed).toBe(true);
    expect(dbUser.onboarding.data.salaryType).toBe('global');

    const profile = await UserProfile.findOne({ user: userId });
    expect(profile).toBeTruthy();
    expect(profile.personal.age).toBe(30);
    expect(profile.insurance.hasHealthInsurance).toBe(true);
  });

  it('preserves sections across multiple PUTs', async () => {
    const { token } = await register();
    await request(app)
      .put('/api/onboarding')
      .set('Authorization', `Bearer ${token}`)
      .send({ data: { personal: { age: 30 } } });
    await request(app)
      .put('/api/onboarding')
      .set('Authorization', `Bearer ${token}`)
      .send({ data: { assets: { ownsCar: true } } });
    const res = await request(app)
      .get('/api/onboarding')
      .set('Authorization', `Bearer ${token}`);
    expect(res.body.data.data.personal.age).toBe(30);
    expect(res.body.data.data.assets.ownsCar).toBe(true);
  });

  describe('Profile route (Settings)', () => {
    it('GET /api/profile returns the profile', async () => {
      const { token } = await register();
      const res = await request(app)
        .get('/api/profile')
        .set('Authorization', `Bearer ${token}`);
      expect(res.statusCode).toBe(200);
      expect(res.body.data.personal).toBeDefined();
    });

    it('PATCH /api/profile updates a section', async () => {
      const { token } = await register();
      const res = await request(app)
        .patch('/api/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ data: { insurance: { hasCarInsurance: true } } });
      expect(res.statusCode).toBe(200);
      expect(res.body.data.insurance.hasCarInsurance).toBe(true);
    });
  });
});
