const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const createApp = require('../../app');
const Document = require('../../models/Document');

let app;
let mongoServer;

const registerAndGetAuth = async () => {
  const response = await request(app).post('/api/auth/register').send({
    name: 'Forecast User',
    email: `forecast-${Date.now()}@test.com`,
    password: 'Test123',
  });

  return {
    token: response.body?.data?.token,
    userId: response.body?.data?.user?.id,
  };
};

describe('Findings savings forecast integration', () => {
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

  it('uses the latest completed document contribution when available', async () => {
    const { token, userId } = await registerAndGetAuth();

    await Document.create({
      user: userId,
      originalName: 'pension.pdf',
      filename: `pension-${Date.now()}.pdf`,
      filePath: '/tmp/pension.pdf',
      fileSize: 1024,
      mimeType: 'application/pdf',
      status: 'completed',
      uploadedAt: new Date('2026-03-01T12:00:00.000Z'),
      processedAt: new Date('2026-03-01T12:05:00.000Z'),
      metadata: {
        category: 'payslip',
        source: 'manual_upload',
      },
      analysisData: {
        contributions: {
          pension: {
            employee: 500,
            employer: 650,
            severance: 830,
          },
        },
      },
    });

    const res = await request(app)
      .post('/api/findings/savings-forecast')
      .set('Authorization', `Bearer ${token}`)
      .send({
        currentBalance: 100000,
        currentAge: 32,
        retirementAge: 35,
        adjustedMonthlyContribution: 2500,
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.data.meta.contributionSource).toBe('document');
    expect(res.body.data.meta.sourceDocumentId).toBeDefined();
    expect(res.body.data.currentScenario.monthlyContribution).toBe(1980);
    expect(res.body.data.currentScenario.projectedBalance).toBe(171280);
    expect(res.body.data.adjustedScenario.projectedBalance).toBe(190000);
    expect(res.body.data.currentScenario.timeline).toHaveLength(4);
  });

  it('falls back to manual contribution when there is no usable document', async () => {
    const { token } = await registerAndGetAuth();

    const res = await request(app)
      .post('/api/findings/savings-forecast')
      .set('Authorization', `Bearer ${token}`)
      .send({
        currentBalance: 100000,
        currentAge: 32,
        retirementAge: 35,
        adjustedMonthlyContribution: 2500,
        currentMonthlyContribution: 1800,
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.data.meta.contributionSource).toBe('manual');
    expect(res.body.data.meta.warnings).toEqual([
      'לא נמצא מסמך פנסיוני תקין. נעשה שימוש בהפקדה הידנית שהוזנה.',
    ]);
    expect(res.body.data.currentScenario.monthlyContribution).toBe(1800);
  });

  it('returns 400 when there is no document contribution and no manual fallback', async () => {
    const { token } = await registerAndGetAuth();

    const res = await request(app)
      .post('/api/findings/savings-forecast')
      .set('Authorization', `Bearer ${token}`)
      .send({
        currentBalance: 100000,
        currentAge: 32,
        retirementAge: 35,
        adjustedMonthlyContribution: 2500,
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'currentMonthlyContribution',
        }),
      ])
    );
  });
});
