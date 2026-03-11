const express = require('express');
const { body } = require('express-validator');
const {
  register,
  login,
  googleLogin,
  getMe,
  updateMe,
  changePassword,
  forgotPassword,
  resetPassword,
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  profileUpload,
  handleProfileUploadError,
} = require('../middleware/profileUpload');
const { updateProfileImage } = require('../controllers/authController');

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

const googleLoginValidation = [
  body('credential')
    .trim()
    .notEmpty()
    .withMessage('Google credential הוא שדה חובה'),
];

const updateMeValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('שם חייב להיות בין 2-50 תווים'),
  body('email')
    .optional()
    .trim()
    .isEmail()
    .withMessage('אימייל לא תקין')
    .normalizeEmail(),
];

const changePasswordValidation = [
  body('currentPassword')
    .notEmpty()
    .withMessage('סיסמה נוכחית היא שדה חובה'),
  body('newPassword')
    .notEmpty()
    .withMessage('סיסמה חדשה היא שדה חובה')
    .isLength({ min: 6 })
    .withMessage('סיסמה חייבת להיות לפחות 6 תווים')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('סיסמה חייבת להכיל אות גדולה, אות קטנה ומספר'),
];

const forgotPasswordValidation = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('אימייל הוא שדה חובה')
    .isEmail()
    .withMessage('אימייל לא תקין')
    .normalizeEmail(),
];

const resetPasswordValidation = [
  body('token')
    .trim()
    .notEmpty()
    .withMessage('token הוא שדה חובה'),
  body('newPassword')
    .notEmpty()
    .withMessage('סיסמה חדשה היא שדה חובה')
    .isLength({ min: 6 })
    .withMessage('סיסמה חייבת להיות לפחות 6 תווים')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('סיסמה חייבת להכיל אות גדולה, אות קטנה ומספר'),
];

// Routes עם validation
router.post('/register', registerValidation, validate, register);
router.post('/login', loginValidation, validate, login);
router.post('/google', googleLoginValidation, validate, googleLogin);
router.post(
  '/forgot-password',
  forgotPasswordValidation,
  validate,
  forgotPassword
);
router.post(
  '/reset-password',
  resetPasswordValidation,
  validate,
  resetPassword
);
router.get('/me', protect, getMe);
router.patch('/me', protect, updateMeValidation, validate, updateMe);
router.post(
  '/change-password',
  protect,
  changePasswordValidation,
  validate,
  changePassword
);
router.post(
  '/profile/image',
  protect,
  profileUpload.single('avatar'),
  handleProfileUploadError,
  updateProfileImage
);

module.exports = router;
