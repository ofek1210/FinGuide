const { decodeUploadFilename } = require('../../middleware/upload');

describe('decodeUploadFilename', () => {
  it('restores Hebrew payslip filenames mangled by multer latin1 decoding', () => {
    const utf8 = 'ינואר 2025.pdf';
    const mangled = Buffer.from(utf8, 'utf8').toString('latin1');
    expect(mangled).not.toBe(utf8);
    expect(decodeUploadFilename(mangled)).toBe(utf8);
  });

  it('leaves already-correct ASCII names unchanged', () => {
    expect(decodeUploadFilename('paycheck-01-2025.pdf')).toBe('paycheck-01-2025.pdf');
  });
});
