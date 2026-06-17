const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const {
  buildTaxAssistantSummary,
  isPayslipDocument,
  isForm106Document,
} = require('../../services/taxAssistantService');

describe('taxAssistantService', () => {
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

  const payslipDoc = (month, overrides = {}) => ({
    user: new mongoose.Types.ObjectId(),
    originalName: `payslip-${month}.pdf`,
    filename: `file-${month}-${Date.now()}.pdf`,
    filePath: `/tmp/p-${month}.pdf`,
    fileSize: 1000,
    mimeType: 'application/pdf',
    status: 'completed',
    metadata: { category: 'payslip', periodMonth: month, periodYear: 2026 },
    analysisData: {
      period: { month: `2026-${String(month).padStart(2, '0')}` },
      salary: { gross_total: 15000, net_payable: 11000 },
      deductions: { mandatory: { income_tax: 1200 } },
      contributions: {
        pension: { employee_amount: 600, employer_amount: 650 },
      },
      parties: { employer_name: overrides.employer || 'חברה א' },
      summary: {
        grossSalary: 15000,
        netSalary: 11000,
        tax: overrides.tax ?? 1200,
        pensionEmployee: overrides.pensionEmployee ?? 600,
        pensionEmployer: overrides.pensionEmployer ?? 650,
      },
    },
    ...overrides.docFields,
  });

  it('isPayslipDocument identifies payslip records', () => {
    expect(isPayslipDocument(payslipDoc(1))).toBe(true);
    expect(
      isPayslipDocument({
        status: 'completed',
        metadata: { category: 'tax_report' },
        analysisData: {},
      }),
    ).toBe(false);
  });

  it('isForm106Document matches tax_report for the same year', () => {
    const doc = {
      status: 'completed',
      metadata: { category: 'tax_report', periodYear: 2026 },
      originalName: 'form106.pdf',
      analysisData: {},
    };
    expect(isForm106Document(doc, 2026)).toBe(true);
  });

  it('detects missing payslips and missing form 106', async () => {
    const Document = require('../../models/Document');
    const userId = new mongoose.Types.ObjectId();

    await Document.insertMany([
      { ...payslipDoc(1), user: userId },
      { ...payslipDoc(2), user: userId },
    ]);

    const result = await buildTaxAssistantSummary(userId, 2026);
    const types = result.issues.map(issue => issue.type);

    expect(types).toContain('missing_payslips');
    expect(types).toContain('missing_form_106');
    expect(result.summary.totalSalaryDocuments).toBe(2);
    expect(result.disclaimer).toContain('הערכה בלבד');
  });

  it('detects multiple employers and unusual tax', async () => {
    const Document = require('../../models/Document');
    const userId = new mongoose.Types.ObjectId();

    await Document.insertMany([
      { ...payslipDoc(1, { employer: 'חברה א' }), user: userId },
      { ...payslipDoc(2, { employer: 'חברה ב' }), user: userId },
      { ...payslipDoc(3, { employer: 'חברה ב', tax: 1200 }), user: userId },
      { ...payslipDoc(4, { employer: 'חברה ב', tax: 3500 }), user: userId },
      {
        ...payslipDoc(5, {
          employer: 'חברה ב',
          tax: 3500,
          pensionEmployee: 0,
          pensionEmployer: 0,
        }),
        user: userId,
      },
      {
        status: 'completed',
        user: userId,
        originalName: '106-2026.pdf',
        filename: '106.pdf',
        filePath: '/tmp/106.pdf',
        fileSize: 500,
        mimeType: 'application/pdf',
        metadata: { category: 'form_106', periodYear: 2026 },
        analysisData: {},
      },
    ]);

    const result = await buildTaxAssistantSummary(userId, 2026);
    const types = result.issues.map(issue => issue.type);

    expect(types).toContain('multiple_employers');
    expect(types).toContain('employer_change');
    expect(types).toContain('unusual_income_tax');
    expect(types).toContain('missing_pension_contributions');
    expect(types).not.toContain('missing_form_106');
    expect(result.summary.employers).toEqual(['חברה א', 'חברה ב']);
  });
});
