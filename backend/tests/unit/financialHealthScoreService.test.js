const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { buildFinancialHealthScore } = require('../../services/financialHealthScoreService');

describe('financialHealthScoreService', () => {
  let mongoServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  afterEach(async () => {
    const Document = require('../../models/Document');
    await Document.deleteMany({});
  });

  const payslip = (month, userId, extra = {}) => ({
    user: userId,
    originalName: `payslip-${month}.pdf`,
    filename: `p-${month}-${Date.now()}.pdf`,
    filePath: `/tmp/p-${month}.pdf`,
    fileSize: 1000,
    mimeType: 'application/pdf',
    status: 'completed',
    metadata: { category: 'payslip', periodMonth: month, periodYear: 2026 },
    analysisData: {
      period: { month: `2026-${String(month).padStart(2, '0')}` },
      salary: { gross_total: 15000, net_payable: 11000 },
      deductions: { mandatory: { income_tax: 1200 } },
      contributions: { pension: { employee_amount: 600, employer_amount: 650 } },
      parties: { employer_name: 'חברה א' },
      summary: {
        grossSalary: 15000,
        netSalary: 11000,
        tax: 1200,
        pensionEmployee: 600,
        pensionEmployer: 650,
      },
    },
    ...extra,
  });

  it('returns low score when no payslips exist', async () => {
    const userId = new mongoose.Types.ObjectId();
    const result = await buildFinancialHealthScore(userId, 2026);

    expect(result.score).toBeLessThan(50);
    expect(result.level).toBe('poor');
    expect(result.categories).toHaveLength(5);
    expect(result.disclaimer).toContain('הציון מבוסס');
  });

  it('returns higher score with complete payslips and form 106', async () => {
    const Document = require('../../models/Document');
    const userId = new mongoose.Types.ObjectId();

    const docs = [];
    for (let month = 1; month <= 11; month += 1) {
      docs.push({ ...payslip(month, userId), user: userId });
    }
    docs.push({
      status: 'completed',
      user: userId,
      originalName: '106-2026.pdf',
      filename: '106.pdf',
      filePath: '/tmp/106.pdf',
      fileSize: 500,
      mimeType: 'application/pdf',
      metadata: { category: 'form_106', periodYear: 2026 },
      analysisData: {},
    });

    await Document.insertMany(docs);

    const result = await buildFinancialHealthScore(userId, 2026);
    expect(result.score).toBeGreaterThanOrEqual(60);
    expect(result.topActions.length).toBeGreaterThan(0);
    const docCategory = result.categories.find(c => c.key === 'documentCompleteness');
    expect(docCategory.score).toBeGreaterThan(15);
  });
});
