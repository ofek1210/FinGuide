const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const createApp = require('../../app');
const Document = require('../../models/Document');
const User = require('../../models/User');

let app;
let mongoServer;

const registerAndGetAuth = async () => {
  const response = await request(app).post('/api/auth/register').send({
    name: 'Fund Finding User',
    email: `fund-findings-${Date.now()}@test.com`,
    password: 'Test123',
  });

  return {
    token: response.body?.data?.token,
    userId: response.body?.data?.user?.id,
  };
};

describe('Findings fund without deposit integration', () => {
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

  it('returns study_fund_no_deposit when payslip has fund section but zero deposits', async () => {
    const { token, userId } = await registerAndGetAuth();

    await Document.create({
      user: userId,
      originalName: 'study-zero.pdf',
      filename: `study-zero-${Date.now()}.pdf`,
      filePath: '/tmp/study-zero.pdf',
      fileSize: 1024,
      mimeType: 'application/pdf',
      status: 'completed',
      uploadedAt: new Date('2026-05-01T12:00:00.000Z'),
      metadata: { category: 'payslip', source: 'manual_upload' },
      analysisData: {
        period: { month: '2026-05' },
        contributions: {
          study_fund: {
            base_salary_for_study_fund: 20800,
            employee: 0,
            employer: 0,
            detection: { sectionDetected: true, noDeposit: true },
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
    expect(ids).toContain('study_fund_no_deposit');
  });

  it('returns onboarding_study_fund_mismatch when declared but latest payslip has no deposit', async () => {
    const { token, userId } = await registerAndGetAuth();

    await User.findByIdAndUpdate(userId, {
      onboarding: {
        completed: true,
        data: { hasStudyFund: true, hasPension: false },
      },
    });

    await Document.create({
      user: userId,
      originalName: 'study-zero.pdf',
      filename: `study-zero-${Date.now()}.pdf`,
      filePath: '/tmp/study-zero.pdf',
      fileSize: 1024,
      mimeType: 'application/pdf',
      status: 'completed',
      uploadedAt: new Date('2026-06-01T12:00:00.000Z'),
      metadata: { category: 'payslip', source: 'manual_upload' },
      analysisData: {
        period: { month: '2026-06' },
        contributions: {
          study_fund: {
            base_salary_for_study_fund: 20000,
            employee: 0,
            employer: 0,
            detection: { sectionDetected: true, noDeposit: true },
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
    expect(ids).toContain('onboarding_study_fund_mismatch');
  });

  it('does not return fund no-deposit finding when contributions are present', async () => {
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
          pension: { employee: 500, employer: 650 },
          study_fund: { employee: 520, employer: 1560 },
        },
        quality: { warning_categories: [] },
      },
    });

    const res = await request(app)
      .get('/api/findings')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const ids = (res.body.data || []).map(item => item.id);
    expect(ids).not.toContain('pension_no_deposit');
    expect(ids).not.toContain('study_fund_no_deposit');
  });
});
