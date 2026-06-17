const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

const getEncryptionKey = () => {
  const secret = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!secret || secret.length < 10) {
    throw new Error('חסר מפתח הצפנה לטוקנים (JWT_SECRET או GOOGLE_TOKEN_ENCRYPTION_KEY)');
  }
  return crypto.createHash('sha256').update(String(secret)).digest();
};

const encrypt = plaintext => {
  if (!plaintext) {
    return null;
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const key = getEncryptionKey();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
};

const decrypt = payload => {
  if (!payload) {
    return null;
  }

  const parts = String(payload).split(':');
  if (parts.length !== 3) {
    throw new Error('פורמט טוקן מוצפן לא תקין');
  }

  const [ivB64, tagB64, dataB64] = parts;
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const encrypted = Buffer.from(dataB64, 'base64');
  const key = getEncryptionKey();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
};

module.exports = {
  encrypt,
  decrypt,
};
