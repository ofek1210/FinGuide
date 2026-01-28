const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * יצירת JWT Token
 * @param {string} userId - ID המשתמש
 * @returns {string} JWT token
 */
const generateToken = userId =>
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
      return res.status(401).json({
        success: false,
        message: 'אימייל או סיסמה לא נכונים',
      });
    }

    // בדיקת סיסמה
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'אימייל או סיסמה לא נכונים',
      });
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
const getMe = async (req, res, next) => {
  try {
    // המשתמש כבר נוסף ל-request על ידי middleware auth
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'משתמש לא נמצא',
      });
    }

    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          createdAt: user.createdAt,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  getMe,
};
