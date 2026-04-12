jest.mock('../../models/Document', () => ({
  findById: jest.fn(),
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
  });

  it('marks document as completed when background processing succeeds', async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    const document = {
      _id: 'doc-success',
      filePath: '/tmp/success.pdf',
      status: 'pending',
      save,
    };

    Document.findById.mockResolvedValue(document);
    extractPayslipFile.mockResolvedValue({
      data: { grossSalary: 10000 },
    });

    await processDocumentNow('doc-success');

    expect(document.status).toBe('completed');
    expect(document.analysisData).toEqual({ grossSalary: 10000 });
    expect(document.processingError).toBeNull();
    expect(document.processedAt).toBeInstanceOf(Date);
    expect(save).toHaveBeenCalledTimes(2);
  });

  it('marks document as failed when background processing crashes', async () => {
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const save = jest.fn().mockResolvedValue(undefined);
    const document = {
      _id: 'doc-failure',
      filePath: '/tmp/failure.pdf',
      status: 'pending',
      save,
    };

    Document.findById.mockResolvedValue(document);
    extractPayslipFile.mockRejectedValue(new Error('ocr failed'));

    await processDocumentNow('doc-failure');

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '❌ Document extraction failed for document',
      'doc-failure',
      expect.any(Error)
    );
    expect(document.status).toBe('failed');
    expect(document.processingError).toBe('ocr failed');
    expect(document.processedAt).toBeInstanceOf(Date);
    expect(save).toHaveBeenCalledTimes(2);

    consoleErrorSpy.mockRestore();
  });
});
