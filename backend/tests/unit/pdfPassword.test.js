const { PdfPasswordRequiredError, isPdfPasswordError } = require('../../utils/pdfPassword');

describe('pdfPassword utilities', () => {
  it('detects password-related PDF errors', () => {
    expect(isPdfPasswordError(new Error('No password given'))).toBe(true);
    expect(isPdfPasswordError({ message: 'encrypted', cause: { message: 'needs password' } })).toBe(
      true
    );
    expect(isPdfPasswordError(new Error('file not found'))).toBe(false);
  });

  it('exposes PdfPasswordRequiredError code', () => {
    const error = new PdfPasswordRequiredError();
    expect(error.code).toBe('PDF_PASSWORD_REQUIRED');
  });
});
