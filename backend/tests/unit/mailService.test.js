jest.mock('nodemailer', () => ({
  createTransport: jest.fn(),
}));

describe('mailService', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      SMTP_HOST: 'smtp.example.com',
      SMTP_PORT: '587',
      SMTP_SECURE: 'false',
      SMTP_USER: 'smtp-user',
      SMTP_PASS: 'smtp-pass',
      SMTP_FROM: 'FinGuide <no-reply@example.com>',
    };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('sends password reset mail via SMTP transport', async () => {
    const nodemailer = require('nodemailer');
    const sendMail = jest.fn().mockResolvedValue({ messageId: 'mid-1' });
    nodemailer.createTransport.mockReturnValue({ sendMail });

    const { sendPasswordResetEmail } = require('../../services/mailService');

    await sendPasswordResetEmail({
      to: 'user@example.com',
      resetUrl: 'https://app.example.com/reset-password?token=raw-token',
      expiresInMinutes: 15,
    });

    expect(nodemailer.createTransport).toHaveBeenCalledWith({
      host: 'smtp.example.com',
      port: 587,
      secure: false,
      auth: {
        user: 'smtp-user',
        pass: 'smtp-pass',
      },
    });
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'FinGuide <no-reply@example.com>',
        to: 'user@example.com',
        subject: 'איפוס סיסמה ל-FinGuide',
      })
    );
  });

  it('throws a generic unavailable message when SMTP is missing', async () => {
    delete process.env.SMTP_HOST;

    const { sendPasswordResetEmail } = require('../../services/mailService');

    await expect(
      sendPasswordResetEmail({
        to: 'user@example.com',
        resetUrl: 'https://app.example.com/reset-password?token=raw-token',
        expiresInMinutes: 15,
      })
    ).rejects.toMatchObject({
      message: 'שירות שליחת המייל לא זמין כרגע',
      statusCode: 500,
    });
  });
});
