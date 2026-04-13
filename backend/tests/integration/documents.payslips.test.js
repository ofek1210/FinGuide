const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const createApp = require('../../app');
const Document = require('../../models/Document');

let app;
let mongoServer;

const registerAndGetAuth = async () => {
  const response = await request(app).post('/api/auth/register').send({
    name: 'Payslip User',
    email: `payslip-${Date.now()}@test.com`,
    password: 'Test123',
  });

  return {
    token: response.body?.data?.token,
    userId: response.body?.data?.user?.id,
  };
};

describe('Payslip document integration', () => {
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

  it('returns canonical payslip history and detail DTOs', async () => {
    const { token, userId } = await registerAndGetAuth();

    const document = await Document.create({
      user: userId,
      originalName: 'salary.pdf',
      filename: `salary-${Date.now()}.pdf`,
      filePath: '/tmp/salary.pdf',
      fileSize: 1024,
      mimeType: 'application/pdf',
      status: 'completed',
      metadata: {
        category: 'payslip',
        periodMonth: 3,
        periodYear: 2026,
        documentDate: new Date('2026-03-15T00:00:00.000Z'),
        source: 'manual_upload',
      },
      analysisData: {
        period: { month: '2026-03' },
        salary: {
          gross_total: 12345,
          net_payable: 9345,
          components: [
            { type: 'base_salary', amount: 11000 },
            { type: 'travel_expenses', amount: 1345 },
          ],
        },
        deductions: {
          mandatory: {
            total: 3000,
            income_tax: 1500,
            national_insurance: 900,
            health_insurance: 600,
          },
        },
        contributions: {
          pension: {
            employee: 500,
            employer: 650,
          },
          study_fund: {
            employee: 200,
            employer: 200,
          },
        },
        parties: {
          employer_name: 'חברת בדיקה',
          employee_name: 'ישראל ישראלי',
          employee_id: '123456789',
        },
        employment: {
          job_percent: 100,
        },
        summary: {
          workingDays: 22,
          workingHours: 186,
          vacationDays: 12,
          sickDays: 5,
        },
      },
    });

    const historyRes = await request(app)
      .get('/api/documents/payslips')
      .set('Authorization', `Bearer ${token}`);

    expect(historyRes.statusCode).toBe(200);
    expect(historyRes.body.success).toBe(true);
    expect(historyRes.body.data.items).toEqual([
      expect.objectContaining({
        id: document._id.toString(),
        grossSalary: 12345,
        netSalary: 9345,
        isLatest: true,
      }),
    ]);
    expect(historyRes.body.data.stats.totalPayslips).toBe(1);

    const detailRes = await request(app)
      .get(`/api/documents/payslips/${document._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(detailRes.statusCode).toBe(200);
    expect(detailRes.body.success).toBe(true);
    expect(detailRes.body.data).toEqual(
      expect.objectContaining({
        id: document._id.toString(),
        employerName: 'חברת בדיקה',
        employeeName: 'ישראל ישראלי',
        employeeId: '123456789',
        grossSalary: 12345,
        netSalary: 9345,
      })
    );
    expect(detailRes.body.data.earnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'משכורת בסיס', amount: 11000 }),
      ])
    );
    expect(detailRes.body.data.deductions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'מס הכנסה', amount: 1500 }),
      ])
    );
  });

  it('returns 404 for a completed document without valid payslip payload', async () => {
    const { token, userId } = await registerAndGetAuth();

    const document = await Document.create({
      user: userId,
      originalName: 'invoice.pdf',
      filename: `invoice-${Date.now()}.pdf`,
      filePath: '/tmp/invoice.pdf',
      fileSize: 1024,
      mimeType: 'application/pdf',
      status: 'completed',
      metadata: {
        category: 'invoice',
        source: 'manual_upload',
      },
      analysisData: {},
    });

    const detailRes = await request(app)
      .get(`/api/documents/payslips/${document._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(detailRes.statusCode).toBe(404);
    expect(detailRes.body.success).toBe(false);
  });
});
