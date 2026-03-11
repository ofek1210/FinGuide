const crypto = require('crypto');
const { AppError } = require('../utils/appErrors');

const DEFAULT_PASSWORD_RESET_EXPIRE_MINUTES = 15;
const PASSWORD_RESET_SERVICE_UNAVAILABLE_MESSAGE =
  'שירות איפוס הסיסמה לא זמין כרגע';

const hashResetToken = token =>
  crypto.createHash('sha256').update(token).digest('hex');

const getPasswordResetExpireMinutes = () => {
  const raw = Number(process.env.PASSWORD_RESET_EXPIRE_MINUTES);
  return Number.isFinite(raw) && raw > 0
    ? raw
    : DEFAULT_PASSWORD_RESET_EXPIRE_MINUTES;
};

const createPasswordResetToken = () => {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const expiresInMinutes = getPasswordResetExpireMinutes();

  return {
    rawToken,
    tokenHash: hashResetToken(rawToken),
    expiresInMinutes,
    expiresAt: new Date(Date.now() + expiresInMinutes * 60 * 1000),
  };
};

const buildPasswordResetUrl = token => {
  const baseUrl = process.env.APP_PUBLIC_URL || process.env.CLIENT_URL;

  if (!baseUrl) {
    throw new AppError(PASSWORD_RESET_SERVICE_UNAVAILABLE_MESSAGE, 500);
  }

  return `${baseUrl.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(token)}`;
};

module.exports = {
  PASSWORD_RESET_SERVICE_UNAVAILABLE_MESSAGE,
  hashResetToken,
  getPasswordResetExpireMinutes,
  createPasswordResetToken,
  buildPasswordResetUrl,
};
