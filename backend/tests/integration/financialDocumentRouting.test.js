/**
 * ניתוב העלאות: כשהמשתמש מצהיר במפורש category=payslip — אסור לנתב את הקובץ
 * לצינור הפנסיה/ביטוח גם אם הפרסר "מזהה" בו קרנות (תלושים ישראליים מכילים
 * שמות קרנות וסכומי הפקדות — רגרסיה אמיתית מפרודקשן, יולי 2026).
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

jest.mock('../../services/harHaKesefService', () => ({
  parseHarHaKesef: jest.fn().mockResolvedValue({
    funds: [{ fundName: 'קרן פנסיה מקיפה', balance: 100000 }],
  }),
}));

jest.mock('../../services/pensionImportService', () => ({
  importPensionFile: jest.fn().mockResolvedValue({ imported: 1 }),
}));

const { createDomainTestHarness } = require('../helpers/domainTestHarness');
const { processFinancialDocument } = require('../../services/financialDocumentService');
const { importPensionFile } = require('../../services/pensionImportService');

describe('processFinancialDocument routing vs declared category', () => {
  const harness = createDomainTestHarness('financial-doc-routing');
  let tmpDir;

  beforeAll(async () => {
    await harness.beforeAll();
    tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'fdr-'));
  });
  afterEach(() => harness.afterEach());
  afterAll(async () => {
    await harness.afterAll();
    await fs.promises.rm(tmpDir, { recursive: true, force: true });
  });

  const writeTempPdf = async name => {
    const filePath = path.join(tmpDir, name);
    await fs.promises.writeFile(filePath, '%PDF-1.4\n%%EOF\n');
    return filePath;
  };

  it('routes a PDF to pension when no payslip category is declared', async () => {
    const { userId } = await harness.register();
    const filePath = await writeTempPdf('quarterly.pdf');

    const result = await processFinancialDocument({
      userId,
      filePath,
      originalName: 'quarterly.pdf',
      source: 'manual',
      metadata: { category: 'other' },
    });

    expect(result.routedTo).toBe('pension');
    expect(importPensionFile).toHaveBeenCalled();
  });

  it('does NOT route when the user declared category=payslip — a Document is created', async () => {
    importPensionFile.mockClear();
    const { userId } = await harness.register();
    const filePath = await writeTempPdf('may-payslip.pdf');

    const result = await processFinancialDocument({
      userId,
      filePath,
      originalName: 'מאי.pdf',
      source: 'manual',
      metadata: { category: 'payslip' },
    });

    expect(result.routedTo).toBeUndefined();
    expect(importPensionFile).not.toHaveBeenCalled();
    // נוצר מסמך תלוש אמיתי (העיבוד עצמו נכשל על PDF ריק — וזה בסדר)
    expect(result._id).toBeDefined();
    expect(result.metadata?.category).toBe('payslip');
  });
});
