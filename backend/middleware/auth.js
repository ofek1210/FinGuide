const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Middleware לאימות JWT
 * בודק את ה-token ומצרף את המשתמש ל-request
 */
const protect = async (req, res, next) => {
  let token;

  // בדיקה אם יש token ב-header
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      // חילוץ ה-token (מסיר את "Bearer ")
      [, token] = req.headers.authorization.split(' ');

      // אימות ה-token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // מציאת המשתמש (ללא הסיסמה)
      req.user = await User.findById(decoded.id).select('-password');

      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'משתמש לא נמצא',
        });
      }

      next();
    } catch (error) {
      console.error('שגיאת אימות:', error);
      return res.status(401).json({
        success: false,
        message: 'לא מורשה, token לא תקין',
      });
    }
  } else {
    return res.status(401).json({
      success: false,
      message: 'לא מורשה, אין token',
    });
  }
};

module.exports = { protect };
