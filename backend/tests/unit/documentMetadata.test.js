const {
  normalizeDocumentMetadataInput,
  getDocumentMetadata,
} = require('../../utils/documentMetadata');
const {
  serializeDocument,
} = require('../../serializers/documentSerializer');
const { ValidationError } = require('../../utils/appErrors');

describe('document metadata utilities', () => {
  it('normalizes valid metadata input', () => {
    const normalized = normalizeDocumentMetadataInput({
      category: 'payslip',
      periodMonth: '3',
      periodYear: '2026',
      documentDate: '2026-03-15',
    });

    expect(normalized.category).toBe('payslip');
    expect(normalized.periodMonth).toBe(3);
    expect(normalized.periodYear).toBe(2026);
    expect(normalized.source).toBe('manual_upload');
    expect(normalized.documentDate).toBeInstanceOf(Date);
  });

  it('rejects partial period metadata', () => {
    expect(() =>
      normalizeDocumentMetadataInput({
        category: 'payslip',
        periodMonth: '3',
      })
    ).toThrow(ValidationError);
  });

  it('returns metadata defaults for legacy documents', () => {
    expect(getDocumentMetadata({})).toEqual({
      category: 'other',
      source: 'manual_upload',
    });
  });

  it('serializes only public document fields', () => {
    const serialized = serializeDocument({
      _id: 'doc1',
      originalName: 'salary.pdf',
      filename: 'secret.pdf',
      filePath: '/tmp/secret.pdf',
      fileSize: 1234,
      mimeType: 'application/pdf',
      status: 'pending',
      uploadedAt: new Date('2026-03-15T10:00:00.000Z'),
      processedAt: null,
      metadata: { category: 'invoice', source: 'manual_upload' },
      checksumSha256: 'a'.repeat(64),
      processingError: 'failed',
      createdAt: new Date('2026-03-15T10:00:00.000Z'),
      updatedAt: new Date('2026-03-15T10:01:00.000Z'),
    });

    expect(serialized).toEqual({
      id: 'doc1',
      originalName: 'salary.pdf',
      fileSize: 1234,
      mimeType: 'application/pdf',
      status: 'pending',
      processingStage: null,
      processingAttempts: 0,
      processingStartedAt: null,
      processingFinishedAt: null,
      uploadedAt: new Date('2026-03-15T10:00:00.000Z'),
      processedAt: null,
      processingError: 'failed',
      metadata: { category: 'invoice', source: 'manual_upload' },
      createdAt: new Date('2026-03-15T10:00:00.000Z'),
      updatedAt: new Date('2026-03-15T10:01:00.000Z'),
    });
  });
});
