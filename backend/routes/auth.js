const express = require('express');
const { body } = require('express-validator');
const { register, login, getMe } = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

/**
 * Validation rules ל-register
 */
const registerValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('שם הוא שדה חובה')
    .isLength({ min: 2, max: 50 })
    .withMessage('שם חייב להיות בין 2-50 תווים'),
  body('email')
    .trim()
    .notEmpty()
    .withMessage('אימייל הוא שדה חובה')
    .isEmail()
    .withMessage('אימייל לא תקין')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('סיסמה היא שדה חובה')
    .isLength({ min: 6 })
    .withMessage('סיסמה חייבת להיות לפחות 6 תווים')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('סיסמה חייבת להכיל אות גדולה, אות קטנה ומספר'),
];

/**
 * Validation rules ל-login
 */
const loginValidation = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('אימייל הוא שדה חובה')
    .isEmail()
    .withMessage('אימייל לא תקין'),
  body('password').notEmpty().withMessage('סיסמה היא שדה חובה'),
];

// Routes עם validation
router.post('/register', registerValidation, validate, register);
router.post('/login', loginValidation, validate, login);
router.get('/me', protect, getMe);

module.exports = router;
