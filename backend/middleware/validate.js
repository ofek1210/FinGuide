const { validationResult } = require('express-validator');
const { ValidationError } = require('../utils/appErrors');

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

    return next(new ValidationError('שגיאות בולידציה', formattedErrors));
  }

  return next();
};

module.exports = validate;
