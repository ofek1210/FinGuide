const {
  computeBufferChecksum,
  formatPeriodLabelHe,
  buildDuplicateMessage,
} = require('../../utils/duplicateUpload');
const { DuplicateUploadError } = require('../../utils/appErrors');

describe('duplicateUpload helpers', () => {
  it('computes stable sha256 checksum for buffers', () => {
    const a = computeBufferChecksum(Buffer.from('same-content'));
    const b = computeBufferChecksum(Buffer.from('same-content'));
    const c = computeBufferChecksum(Buffer.from('other-content'));
    expect(a).toHaveLength(64);
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it('formats Hebrew period labels', () => {
    expect(formatPeriodLabelHe(2026, 6)).toBe('יוני 2026');
    expect(formatPeriodLabelHe(2026, 13)).toBeNull();
  });

  it('builds domain-specific duplicate messages', () => {
    expect(buildDuplicateMessage({ kind: 'insurance' })).toContain('ביטוח');
    expect(buildDuplicateMessage({ kind: 'pension' })).toContain('פנסיה');
    expect(buildDuplicateMessage({ kind: 'payslip', periodLabel: 'יוני 2026' })).toContain('יוני 2026');
  });

  it('DuplicateUploadError uses 409 status', () => {
    const err = new DuplicateUploadError('תלוש יוני 2026 כבר קיים במערכת', { kind: 'payslip' });
    expect(err.statusCode).toBe(409);
    expect(err.type).toBe('DuplicateUploadError');
  });
});
