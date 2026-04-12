const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { AuthError } = require('../utils/appErrors');

/**
 * Middleware לאימות JWT
 * בודק את ה-token ומצרף את המשתמש ל-request
 */
const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      [, token] = req.headers.authorization.split(' ');

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      req.user = await User.findById(decoded.id).select('-password');

      if (!req.user) {
        return next(new AuthError('משתמש לא נמצא', 401));
      }

      return next();
    } catch (error) {
      return next(new AuthError('לא מורשה, token לא תקין', 401));
    }
  } else {
    return next(new AuthError('לא מורשה, אין token', 401));
  }
};

module.exports = { protect };
