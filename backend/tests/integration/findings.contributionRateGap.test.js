jest.setTimeout(120000);

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const createApp = require('../../app');
const Document = require('../../models/Document');

let app;
let mongoServer;

const registerAndGetAuth = async () => {
  const response = await request(app).post('/api/auth/register').send({
    name: 'Rate Gap User',
    email: `rate-gap-${Date.now()}@test.com`,
    password: 'Test123',
  });

  return {
    token: response.body?.data?.token,
    userId: response.body?.data?.user?.id,
  };
};

describe('Findings contribution rate gap integration', () => {
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

  it('returns pension_rate_inconsistency for mismatched stated vs implied rates', async () => {
    const { token, userId } = await registerAndGetAuth();

    await Document.create({
      user: userId,
      originalName: 'gap.pdf',
      filename: `gap-${Date.now()}.pdf`,
      filePath: '/tmp/gap.pdf',
      fileSize: 1024,
      mimeType: 'application/pdf',
      status: 'completed',
      uploadedAt: new Date('2026-06-01T12:00:00.000Z'),
      metadata: { category: 'payslip', source: 'manual_upload' },
      analysisData: {
        period: { month: '2026-06' },
        contributions: {
          pension: {
            base_salary_for_pension: 26000,
            employee: 1400,
            employer: 1690,
            employee_rate_percent: 6,
            employer_rate_percent: 6.5,
            detection: { sectionDetected: true, noDeposit: false },
          },
        },
        quality: { warning_categories: [] },
      },
    });

    const res = await request(app)
      .get('/api/findings')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const ids = (res.body.data || []).map(item => item.id);
    expect(ids).toContain('pension_rate_inconsistency');
  });

  it('does not return rate findings when rates are consistent', async () => {
    const { token, userId } = await registerAndGetAuth();

    await Document.create({
      user: userId,
      originalName: 'ok.pdf',
      filename: `ok-${Date.now()}.pdf`,
      filePath: '/tmp/ok.pdf',
      fileSize: 1024,
      mimeType: 'application/pdf',
      status: 'completed',
      uploadedAt: new Date('2026-05-01T12:00:00.000Z'),
      metadata: { category: 'payslip', source: 'manual_upload' },
      analysisData: {
        period: { month: '2026-05' },
        contributions: {
          pension: {
            base_salary_for_pension: 26000,
            employee: 1560,
            employer: 1690,
            employee_rate_percent: 6,
            employer_rate_percent: 6.5,
            detection: { sectionDetected: true, noDeposit: false },
          },
          study_fund: {
            base_salary_for_study_fund: 20800,
            employee: 520,
            employer: 1560,
            employee_rate_percent: 2.5,
            employer_rate_percent: 7.5,
            detection: { sectionDetected: true, noDeposit: false },
          },
        },
        quality: { warning_categories: [] },
      },
    });

    const res = await request(app)
      .get('/api/findings')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const ids = (res.body.data || []).map(item => item.id);
    expect(ids).not.toContain('pension_rate_inconsistency');
    expect(ids).not.toContain('study_fund_rate_inconsistency');
  });
});
