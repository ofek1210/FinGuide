const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const createApp = require('../../app');
const Document = require('../../models/Document');
const Insight = require('../../models/Insight');

describe('Insights integration', () => {
  let app;
  let mongoServer;
  let token;
  let userId;

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
      name: 'Insights User',
      email: `ins-${Date.now()}-${Math.random()}@test.com`,
      password: 'Test123',
    });
    token = res.body.data.token;
    userId = res.body.data.user.id;
  });

  afterEach(async () => {
    await Promise.all(Object.values(mongoose.connection.collections).map(c => c.deleteMany({})));
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  });

  it('GET /api/insights returns empty list initially', async () => {
    const res = await request(app)
      .get('/api/insights')
      .set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.count).toBe(0);
  });

  it('POST /api/insights/run creates insights from payslips', async () => {
    await Document.create({
      user: userId,
      originalName: 'p1.pdf',
      filename: 'p1.pdf',
      filePath: '/tmp/p1.pdf',
      fileSize: 100,
      mimeType: 'application/pdf',
      status: 'completed',
      metadata: { periodYear: 2026, periodMonth: 1 },
      analysisData: {
        period: { month: '01/2026' },
        salary: { gross_total: 20000, net_payable: 14000 },
        summary: { grossSalary: 20000, netSalary: 14000, pensionEmployee: 1200 },
        contributions: { pension: { employee_amount: 1200 } },
        deductions: { mandatory: { total: 6000, income_tax: 3000 } },
      },
    });
    await Document.create({
      user: userId,
      originalName: 'p2.pdf',
      filename: 'p2.pdf',
      filePath: '/tmp/p2.pdf',
      fileSize: 100,
      mimeType: 'application/pdf',
      status: 'completed',
      metadata: { periodYear: 2026, periodMonth: 2 },
      analysisData: {
        period: { month: '02/2026' },
        salary: { gross_total: 17000, net_payable: 12000 },
        summary: { grossSalary: 17000, netSalary: 12000, pensionEmployee: 1000 },
        contributions: { pension: { employee_amount: 1000 } },
        deductions: { mandatory: { total: 5000, income_tax: 2500 } },
      },
    });

    const res = await request(app)
      .post('/api/insights/run')
      .set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.count).toBeGreaterThan(0);

    const salaryDrop = res.body.data.find(i => i.kind === 'salary_drop');
    expect(salaryDrop).toBeTruthy();
  });

  it('POST /api/insights/:id/dismiss marks insight dismissed', async () => {
    const insight = await Insight.create({
      user: userId,
      kind: 'salary_drop',
      severity: 'warning',
      title: 'Test',
      description: 'Test desc',
    });
    const res = await request(app)
      .post(`/api/insights/${insight._id}/dismiss`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.status).toBe('dismissed');
  });
});
