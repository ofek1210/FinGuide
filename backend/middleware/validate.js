const { validationResult } = require('express-validator');

/**
 * Middleware לבדיקת שגיאות validation
 * מחזיר 400 עם רשימת שגיאות אם יש, אחרת ממשיך
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map(error => ({
      field: error.path,
      message: error.msg,
      value: error.value,
    }));

    return res.status(400).json({
      success: false,
      message: 'שגיאות בולידציה',
      errors: formattedErrors,
    });
  }

  next();
};

module.exports = validate;
