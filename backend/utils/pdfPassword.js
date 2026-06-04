class PdfPasswordRequiredError extends Error {
  constructor(message = 'נדרשת סיסמה לפתיחת קובץ ה-PDF') {
    super(message);
    this.name = 'PdfPasswordRequiredError';
    this.code = 'PDF_PASSWORD_REQUIRED';
  }
}

const collectErrorMessages = error => {
  const parts = [];
  let current = error;
  for (let depth = 0; depth < 6 && current; depth += 1) {
    if (typeof current.message === 'string' && current.message.trim()) {
      parts.push(current.message);
    }
    current = current.cause;
  }
  return parts.join(' ');
};

const isPdfPasswordError = error => {
  const text = collectErrorMessages(error).toLowerCase();
  return (
    /password|encrypted|decrypt|needs?\s*(a\s*)?password|owner\s*password|incorrect password|requires a password/i.test(
      text
    ) || error?.name === 'PasswordException'
  );
};

module.exports = {
  PdfPasswordRequiredError,
  isPdfPasswordError,
};
