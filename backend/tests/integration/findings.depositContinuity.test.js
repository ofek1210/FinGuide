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
    name: 'Continuity User',
    email: `continuity-${Date.now()}@test.com`,
    password: 'Test123',
  });

  return {
    token: response.body?.data?.token,
    userId: response.body?.data?.user?.id,
  };
};

describe('Findings deposit continuity integration', () => {
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

  it('returns pension_deposit_break_on_payslip for sandwiched no-deposit month', async () => {
    const { token, userId } = await registerAndGetAuth();

    const pensionBlock = (employee, employer) => ({
      base_salary_for_pension: 26000,
      employee,
      employer,
      detection: { sectionDetected: true, noDeposit: employee === 0 && employer === 0 },
    });

    for (const [month, employee, employer] of [
      ['2024-01', 1560, 1690],
      ['2024-02', 1560, 1690],
      ['2024-03', 0, 0],
      ['2024-04', 1560, 1690],
    ]) {
      await Document.create({
        user: userId,
        originalName: `${month}.pdf`,
        filename: `${month}-${Date.now()}.pdf`,
        filePath: `/tmp/${month}.pdf`,
        fileSize: 1024,
        mimeType: 'application/pdf',
        status: 'completed',
        uploadedAt: new Date(`${month}-15`),
        metadata: { category: 'payslip' },
        analysisData: {
          period: { month },
          contributions: { pension: pensionBlock(employee, employer) },
          quality: { warning_categories: [] },
        },
      });
    }

    const res = await request(app)
      .get('/api/findings')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const ids = (res.body.data || []).map(item => item.id);
    expect(ids).toContain('pension_deposit_break_on_payslip');
    expect(ids).not.toContain('pension_no_deposit');
  });

  it('returns pension_deposit_break_missing_payslip when February payslip is absent', async () => {
    const { token, userId } = await registerAndGetAuth();

    for (const month of ['2024-01', '2024-03', '2024-04']) {
      await Document.create({
        user: userId,
        originalName: `${month}.pdf`,
        filename: `${month}-${Date.now()}.pdf`,
        filePath: `/tmp/${month}.pdf`,
        fileSize: 1024,
        mimeType: 'application/pdf',
        status: 'completed',
        uploadedAt: new Date(`${month}-15`),
        metadata: { category: 'payslip' },
        analysisData: {
          period: { month },
          contributions: {
            pension: {
              base_salary_for_pension: 26000,
              employee: 1560,
              employer: 1690,
              detection: { sectionDetected: true, noDeposit: false },
            },
          },
          quality: { warning_categories: [] },
        },
      });
    }

    const res = await request(app)
      .get('/api/findings')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const ids = (res.body.data || []).map(item => item.id);
    expect(ids).toContain('pension_deposit_break_missing_payslip');
  });

  it('returns study_fund_deposit_break_on_payslip for study fund gap', async () => {
    const { token, userId } = await registerAndGetAuth();

    const studyBlock = (employee, employer) => ({
      base_salary_for_study_fund: 20000,
      employee,
      employer,
      detection: { sectionDetected: true, noDeposit: employee === 0 && employer === 0 },
    });

    for (const [month, employee, employer] of [
      ['2024-01', 500, 1500],
      ['2024-02', 500, 1500],
      ['2024-03', 0, 0],
      ['2024-04', 500, 1500],
    ]) {
      await Document.create({
        user: userId,
        originalName: `${month}-study.pdf`,
        filename: `${month}-study-${Date.now()}.pdf`,
        filePath: `/tmp/${month}-study.pdf`,
        fileSize: 1024,
        mimeType: 'application/pdf',
        status: 'completed',
        uploadedAt: new Date(`${month}-15`),
        metadata: { category: 'payslip' },
        analysisData: {
          period: { month },
          contributions: { study_fund: studyBlock(employee, employer) },
          quality: { warning_categories: [] },
        },
      });
    }

    const res = await request(app)
      .get('/api/findings')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const ids = (res.body.data || []).map(item => item.id);
    expect(ids).toContain('study_fund_deposit_break_on_payslip');
  });
});
