const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME || 'fg_session';

const parseCookieHeader = headerValue => {
  if (!headerValue || typeof headerValue !== 'string') {
    return {};
  }

  return headerValue.split(';').reduce((cookies, chunk) => {
    const [rawName, ...rawValueParts] = chunk.split('=');
    const name = rawName ? rawName.trim() : '';
    if (!name) {
      return cookies;
    }

    const rawValue = rawValueParts.join('=').trim();
    cookies[name] = decodeURIComponent(rawValue);
    return cookies;
  }, {});
};

const getRequestCookies = req => parseCookieHeader(req?.headers?.cookie);

const getSessionTokenFromRequest = req => {
  const cookies = getRequestCookies(req);
  return cookies[SESSION_COOKIE_NAME] || null;
};

const isSecureCookie = () => process.env.NODE_ENV === 'production';

const buildSessionCookieOptions = () => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: isSecureCookie(),
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000,
});

const setSessionCookie = (res, token) => {
  const options = buildSessionCookieOptions();
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    `Max-Age=${Math.floor(options.maxAge / 1000)}`,
    `Path=${options.path}`,
    'HttpOnly',
    `SameSite=${options.sameSite}`,
  ];

  if (options.secure) {
    parts.push('Secure');
  }

  res.append('Set-Cookie', parts.join('; '));
};

const clearSessionCookie = res => {
  const options = buildSessionCookieOptions();
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    'Max-Age=0',
    `Path=${options.path}`,
    'HttpOnly',
    `SameSite=${options.sameSite}`,
  ];

  if (options.secure) {
    parts.push('Secure');
  }

  res.append('Set-Cookie', parts.join('; '));
};

module.exports = {
  SESSION_COOKIE_NAME,
  getRequestCookies,
  getSessionTokenFromRequest,
  setSessionCookie,
  clearSessionCookie,
};
