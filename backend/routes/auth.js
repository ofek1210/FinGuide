const express = require('express');
const { body } = require('express-validator');
const { register, login, getMe } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

const router = express.Router();

/**
 * Validation rules ל-register
 */
const registerValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('שם הוא שדה חובה')
    .isLength({ min: 2, max: 100 })
    .withMessage('שם חייב להיות בין 2 ל-100 תווים'),
  body('email')
    .trim()
    .notEmpty()
    .withMessage('אימייל הוא שדה חובה')
    .isEmail()
    .withMessage('אנא הזן אימייל תקין')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('סיסמה היא שדה חובה')
    .isLength({ min: 6 })
    .withMessage('סיסמה חייבת להכיל לפחות 6 תווים')
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
    .withMessage('אנא הזן אימייל תקין')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('סיסמה היא שדה חובה')
];

// Routes
router.post('/register', registerValidation, register);
router.post('/login', loginValidation, login);
router.get('/me', protect, getMe);

module.exports = router;
