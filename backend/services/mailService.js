const nodemailer = require('nodemailer');
const { AppError } = require('../utils/appErrors');

const MAIL_SERVICE_UNAVAILABLE_MESSAGE = 'שירות שליחת המייל לא זמין כרגע';

const parseBoolean = value => String(value).toLowerCase() === 'true';

const getTransportConfig = () => {
  const requiredVars = [
    'SMTP_HOST',
    'SMTP_PORT',
    'SMTP_USER',
    'SMTP_PASS',
    'SMTP_FROM',
  ];

  const missing = requiredVars.filter(name => !process.env[name]);
  if (missing.length > 0) {
    throw new AppError(MAIL_SERVICE_UNAVAILABLE_MESSAGE, 500);
  }

  return {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: parseBoolean(process.env.SMTP_SECURE),
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  };
};

let transporter;

const getTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport(getTransportConfig());
  }

  return transporter;
};

const sendPasswordResetEmail = async ({ to, resetUrl, expiresInMinutes }) => {
  let transport;
  try {
    transport = getTransporter();
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError(MAIL_SERVICE_UNAVAILABLE_MESSAGE, 500);
  }

  try {
    await transport.sendMail({
      from: process.env.SMTP_FROM,
      to,
      subject: 'איפוס סיסמה ל-FinGuide',
      text: [
        'קיבלנו בקשה לאיפוס הסיסמה שלכם ב-FinGuide.',
        `כדי לבחור סיסמה חדשה, לחצו על הקישור הבא: ${resetUrl}`,
        `הקישור תקף ל-${expiresInMinutes} דקות.`,
        'אם לא ביקשתם לאפס את הסיסמה, אפשר להתעלם מהמייל הזה.',
      ].join('\n\n'),
      html: `
        <div dir="rtl" style="font-family: Arial, sans-serif; line-height: 1.6;">
          <p>קיבלנו בקשה לאיפוס הסיסמה שלכם ב-FinGuide.</p>
          <p>
            כדי לבחור סיסמה חדשה, לחצו על הקישור הבא:
            <a href="${resetUrl}">${resetUrl}</a>
          </p>
          <p>הקישור תקף ל-${expiresInMinutes} דקות.</p>
          <p>אם לא ביקשתם לאפס את הסיסמה, אפשר להתעלם מהמייל הזה.</p>
        </div>
      `,
    });
  } catch (error) {
    throw new AppError(MAIL_SERVICE_UNAVAILABLE_MESSAGE, 500);
  }
};

module.exports = {
  MAIL_SERVICE_UNAVAILABLE_MESSAGE,
  sendPasswordResetEmail,
};
