

jest.mock('../../services/financialDocumentService', () => ({
  computeFileChecksum: jest.fn().mockResolvedValue('test-checksum'),
  processFinancialDocument: jest.fn().mockImplementation(async ({ userId, originalName, metadata, checksumSha256 }) => {
    const Document = require('../../models/Document');
    return Document.create({
      user: userId,
      originalName,
      filename: 'test.pdf',
      filePath: 'uploads/test.pdf',
      mimeType: 'application/pdf',
      fileSize: 1000,
      status: 'completed',
      checksumSha256,
      metadata: {
        category: metadata?.category || 'payslip',
        periodMonth: Number(metadata?.periodMonth) || 3,
        periodYear: Number(metadata?.periodYear) || 2026,
      },
      analysisData: {
        schema_version: '1.9',
        summary: { grossSalary: 15000, netSalary: 11000, tax: 1200 },
        salary: { gross_total: 15000, net_payable: 11000 },
        contributions: {
          pension: { employee_amount: 750, employer_amount: 650 },
          study_fund: { employee_amount: 375, employer_amount: 375 },
        },
        deductions: { mandatory: { income_tax: 1200 } },
      },
    });
  }),
}));

jest.mock('../../services/summaryEmailService', () => ({
  sendSummaryEmail: jest.fn().mockImplementation(async user => ({
    sentTo: user.email,
    payslipInsights: 0,
    insuranceInsights: 0,
    pensionInsights: 0,
  })),
  buildWhatsAppShareUrl: jest.fn().mockReturnValue('https://wa.me/?text=test'),
}));

const request = require('supertest');
const fs = require('fs');
const path = require('path');
const { createDomainTestHarness } = require('../helpers/domainTestHarness');
const { buildHarBituachExcel } = require('../fixtures/buildHarBituachExcel');

const PENSION_FIXTURE = path.join(__dirname, '../fixtures/har-hakesef/sample-report.xlsx');
const PAYSLIP_FIXTURE = path.join(__dirname, '../fixtures/sample.pdf');

describe('Smoke journeys', () => {
  const harness = createDomainTestHarness('smoke', { mockAi: true });

  beforeAll(() => harness.beforeAll());
  afterEach(() => harness.afterEach());
  afterAll(() => harness.afterAll());

  it('1: register → upload payslip → GET findings', async () => {
    const app = harness.getApp();
    const { token } = await harness.register();

    const uploadRes = await request(app)
      .post('/api/documents/upload')
      .set('Authorization', `Bearer ${token}`)
      .field('category', 'payslip')
      .field('periodMonth', '3')
      .field('periodYear', '2026')
      .attach('document', PAYSLIP_FIXTURE);

    expect(uploadRes.statusCode).toBe(201);

    const findingsRes = await request(app)
      .get('/api/findings')
      .set('Authorization', `Bearer ${token}`);

    expect(findingsRes.statusCode).toBe(200);
    expect(Array.isArray(findingsRes.body.data)).toBe(true);
  });

  it('2: register → pension Excel → GET analysis + findings', async () => {
    const app = harness.getApp();
    const { token } = await harness.register();
    const buffer = fs.readFileSync(PENSION_FIXTURE);

    await request(app)
      .post('/api/pension/upload-file')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', buffer, 'har-kesef-report.xlsx');

    const analysisRes = await request(app)
      .get('/api/pension/analysis')
      .set('Authorization', `Bearer ${token}`);

    expect(analysisRes.statusCode).toBe(200);
    expect(analysisRes.body.data.summary.hasData).toBe(true);

    const findingsRes = await request(app)
      .get('/api/findings')
      .set('Authorization', `Bearer ${token}`);

    expect(findingsRes.statusCode).toBe(200);
    expect(findingsRes.body.count).toBeGreaterThan(0);
  });

  it('3: register → insurance Excel → GET analysis', async () => {
    const app = harness.getApp();
    const { token } = await harness.register();
    const buffer = buildHarBituachExcel([{ 'חברה': 'הפניקס', 'סוג': 'ביטוח חיים', 'פרמיה': 150, 'סכום': 500000, 'מספר פוליסה': 'L-001' }]);

    await request(app)
      .post('/api/insurance/upload-excel')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', buffer, 'har-bituach.xlsx');

    const res = await request(app)
      .get('/api/insurance/analysis')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.healthCheck).toBeTruthy();
    expect(res.body.data.summary.policyCount).toBeGreaterThan(0);
  });

  it('4: register → POST summary-email (mock SMTP)', async () => {
    const app = harness.getApp();
    const { token } = await harness.register();

    const res = await request(app)
      .post('/api/summary-email/send')
      .set('Authorization', `Bearer ${token}`)
      .send({ consent: true });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.sentTo).toBeTruthy();
  });

  it('5: register → POST /api/ai/full-analysis skipLLM', async () => {
    const app = harness.getApp();
    const { token } = await harness.register();

    const res = await request(app)
      .post('/api/ai/full-analysis')
      .set('Authorization', `Bearer ${token}`)
      .send({ skipLLM: true });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.agents).toBeTruthy();
  });

  it('6: register → pension + insurance import → dashboard summary without payslip', async () => {
    const app = harness.getApp();
    const { token, userId } = await harness.register();
    const pensionBuffer = fs.readFileSync(PENSION_FIXTURE);
    const insuranceBuffer = buildHarBituachExcel();

    await request(app)
      .post('/api/pension/upload-file')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', pensionBuffer, 'har-kesef-report.xlsx');

    const UserProfile = require('../../models/UserProfile');
    await UserProfile.findOneAndUpdate(
      { user: userId },
      { $set: { 'personal.age': 35, 'retirement.plannedRetirementAge': 67 } },
      { upsert: true },
    );

    await request(app)
      .post('/api/insurance/upload-excel')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', insuranceBuffer, 'har-bituach.xlsx');

    const res = await request(app)
      .get('/api/dashboard/summary')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.scores.pension).not.toBeNull();
    expect(res.body.data.scores.insurance).not.toBeNull();
    expect(res.body.data.scores.payslip).toBeNull();
    expect(res.body.data.documents.completed).toBe(0);
  });
});
