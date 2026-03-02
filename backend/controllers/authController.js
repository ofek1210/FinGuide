const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { AuthError } = require('../utils/appErrors');

/**
 * יצירת JWT Token
 * @param {string} userId - ID המשתמש
 * @returns {string} JWT token
 */
const generateToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d',
  });

/**
 * @route   POST /api/auth/register
 * @desc    הרשמת משתמש חדש
 * @access  Public
 */
const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    // בדיקה אם המשתמש כבר קיים
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({
        success: false,
        message: 'משתמש עם אימייל זה כבר קיים',
      });
    }

    // יצירת משתמש חדש
    const user = await User.create({
      name,
      email,
      password,
    });

    // יצירת token
    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
        },
        token,
      },
      message: 'ההרשמה בוצעה בהצלחה',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/auth/login
 * @desc    התחברות משתמש
 * @access  Public
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // מציאת משתמש עם הסיסמה (select: false דורש select מפורש)
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return next(new AuthError('אימייל או סיסמה לא נכונים', 401));
    }

    // בדיקת סיסמה
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return next(new AuthError('אימייל או סיסמה לא נכונים', 401));
    }

    // יצירת token
    const token = generateToken(user._id);

    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
        },
        token,
      },
      message: 'התחברות בוצעה בהצלחה',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/auth/me
 * @desc    קבלת משתמש נוכחי
 * @access  Private (דורש JWT)
 */
const getMe = async (req, res) => {
  // המשתמש כבר נטען על ידי middleware protect
  res.json({
    success: true,
    data: {
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        createdAt: req.user.createdAt,
      },
    },
  });
};

module.exports = {
  register,
  login,
  getMe,
};
