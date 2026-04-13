jest.mock('../../models/Document', () => ({
  findById: jest.fn(),
  findOneAndUpdate: jest.fn(),
}));

jest.mock('../../services/payslipOcr', () => ({
  extractPayslipFile: jest.fn(),
}));

const Document = require('../../models/Document');
const { extractPayslipFile } = require('../../services/payslipOcr');
const { processDocumentNow } = require('../../services/documentProcessingService');

describe('documentProcessingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Document.findOneAndUpdate.mockResolvedValue(null);
  });

  it('marks document as completed when background processing succeeds', async () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const save = jest.fn().mockResolvedValue(undefined);
    const document = {
      _id: 'doc-success',
      filePath: '/tmp/success.pdf',
      status: 'pending',
      processingAttempts: 0,
      ocrDebugArtifactPath: null,
      save,
    };

    Document.findById.mockResolvedValue(document);
    extractPayslipFile.mockResolvedValue({
      data: {
        schema_version: '1.9',
        salary: { gross_total: 10000, net_payable: 8200, components: [] },
        deductions: { mandatory: { total: 1800 } },
        contributions: { pension: { employee: 600, employer: 650 } },
        parties: { employee_name: 'Test User', employee_id: '123456789' },
        employment: {},
        summary: { date: '2026-03-15' },
        quality: { confidence: 0.9, resolution_score: 0.9, warnings: [] },
      },
    });

    await processDocumentNow('doc-success');

    expect(document.status).toBe('completed');
    expect(document.processingStage).toBe('completed');
    expect(document.analysisData).toMatchObject({
      schema_version: '1.9',
      salary: { gross_total: 10000, net_payable: 8200 },
      parties: { employee_name: 'Test User', employee_id: '123456789' },
    });
    expect(document.processingError).toBeNull();
    expect(document.processedAt).toBeInstanceOf(Date);
    expect(save).toHaveBeenCalledTimes(2);

    consoleLogSpy.mockRestore();
  });

  it('marks document as failed when background processing crashes', async () => {
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const save = jest.fn().mockResolvedValue(undefined);
    const document = {
      _id: 'doc-failure',
      filePath: '/tmp/failure.pdf',
      status: 'pending',
      processingAttempts: 0,
      ocrDebugArtifactPath: null,
      save,
    };

    Document.findById.mockResolvedValue(document);
    extractPayslipFile.mockRejectedValue(new Error('ocr failed'));

    await processDocumentNow('doc-failure');

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[documentProcessing]',
      expect.objectContaining({
        level: 'error',
        message: 'processing_failed',
        documentId: 'doc-failure',
      })
    );
    expect(document.status).toBe('failed');
    expect(document.processingStage).toBe('failed');
    expect(document.processingError).toBe('ocr failed');
    expect(document.processedAt).toBeInstanceOf(Date);
    expect(save).toHaveBeenCalledTimes(2);

    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });
});
