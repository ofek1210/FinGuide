const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { AuthError } = require('../utils/appErrors');

/**
 * Middleware לאימות JWT
 * בודק את ה-token ומצרף את המשתמש ל-request
 */
const protect = async (req, res, next) => {
  let token;

  // eslint-disable-next-line no-console
  console.log('[auth] protect headers.authorization =', req.headers.authorization);

  // בדיקה אם יש token ב-header
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    // eslint-disable-next-line no-console
    console.log('[auth] Bearer header detected');

    try {
      // חילוץ ה-token (מסיר את "Bearer ")
      [, token] = req.headers.authorization.split(' ');
      // eslint-disable-next-line no-console
      console.log('[auth] extracted token length =', token ? token.length : 0);

      // אימות ה-token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      // eslint-disable-next-line no-console
      console.log('[auth] jwt.verify decoded payload =', decoded);

      // מציאת המשתמש (ללא הסיסמה)
      req.user = await User.findById(decoded.id).select('-password');
      // eslint-disable-next-line no-console
      console.log('[auth] user lookup result id =', req.user ? req.user.id : null);

      if (!req.user) {
        return next(new AuthError('משתמש לא נמצא', 401));
      }

      return next();
    } catch (error) {
      console.error('[auth] jwt verification / user lookup error:', error);
      return next(new AuthError('לא מורשה, token לא תקין', 401));
    }
  } else {
    // eslint-disable-next-line no-console
    console.log('[auth] no Bearer token header – returning "אין token"');
    return next(new AuthError('לא מורשה, אין token', 401));
  }
};

module.exports = { protect };
