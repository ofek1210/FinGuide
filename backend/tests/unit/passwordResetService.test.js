const {
  hashResetToken,
  getPasswordResetExpireMinutes,
  createPasswordResetToken,
  buildPasswordResetUrl,
  PASSWORD_RESET_SERVICE_UNAVAILABLE_MESSAGE,
} = require('../../services/passwordResetService');

describe('passwordResetService', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('hashes the raw token deterministically', () => {
    expect(hashResetToken('abc123')).toBe(hashResetToken('abc123'));
    expect(hashResetToken('abc123')).not.toBe('abc123');
  });

  it('uses configured expiry when valid', () => {
    process.env.PASSWORD_RESET_EXPIRE_MINUTES = '30';

    expect(getPasswordResetExpireMinutes()).toBe(30);
  });

  it('falls back to 15 minutes when expiry is missing or invalid', () => {
    delete process.env.PASSWORD_RESET_EXPIRE_MINUTES;
    expect(getPasswordResetExpireMinutes()).toBe(15);

    process.env.PASSWORD_RESET_EXPIRE_MINUTES = '-4';
    expect(getPasswordResetExpireMinutes()).toBe(15);
  });

  it('creates a raw token, hash, and expiry window', () => {
    process.env.PASSWORD_RESET_EXPIRE_MINUTES = '20';

    const token = createPasswordResetToken();

    expect(token.rawToken).toHaveLength(64);
    expect(token.tokenHash).toBe(hashResetToken(token.rawToken));
    expect(token.expiresInMinutes).toBe(20);
    expect(token.expiresAt).toBeInstanceOf(Date);
    expect(token.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('builds reset URL from APP_PUBLIC_URL and encodes the token', () => {
    process.env.APP_PUBLIC_URL = 'https://app.finguide.test/';

    expect(buildPasswordResetUrl('raw token')).toBe(
      'https://app.finguide.test/reset-password?token=raw%20token'
    );
  });

  it('falls back to CLIENT_URL when APP_PUBLIC_URL is missing', () => {
    delete process.env.APP_PUBLIC_URL;
    process.env.CLIENT_URL = 'https://client.finguide.test';

    expect(buildPasswordResetUrl('abc')).toBe(
      'https://client.finguide.test/reset-password?token=abc'
    );
  });

  it('throws a generic service error when no public URL is configured', () => {
    delete process.env.APP_PUBLIC_URL;
    delete process.env.CLIENT_URL;

    expect(() => buildPasswordResetUrl('abc')).toThrow(
      PASSWORD_RESET_SERVICE_UNAVAILABLE_MESSAGE
    );
  });
});
