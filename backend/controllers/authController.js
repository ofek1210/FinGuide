const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const { AuthError } = require('../utils/appErrors');

const googleClient = new OAuth2Client();

/**
 * יצירת JWT Token
 * @param {string} userId - ID המשתמש
 * @returns {string} JWT token
 */
const generateToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d',
  });

const buildAuthResponse = user => ({
  success: true,
  data: {
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl || null,
    },
  },
  message: 'התחברות בוצעה בהצלחה',
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
    const response = buildAuthResponse(user);
    response.data.token = token;
    res.json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/auth/google
 * @desc    התחברות משתמש באמצעות Google ID Token
 * @access  Public
 */
const googleLogin = async (req, res, next) => {
  const { credential } = req.body;

  if (!credential) {
    return res.status(400).json({
      success: false,
      message: 'Google credential הוא שדה חובה',
    });
  }

  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  if (!googleClientId) {
    return res.status(500).json({
      success: false,
      message: 'Google auth לא הוגדר בשרת',
    });
  }

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: googleClientId,
    });
    payload = ticket.getPayload();
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Google auth verification failed:', error.message);
    }

    return res.status(401).json({
      success: false,
      message: 'Google credential לא תקף',
    });
  }

  if (!payload || !payload.sub || !payload.email || payload.email_verified !== true) {
    return res.status(401).json({
      success: false,
      message: 'Google credential לא תקף',
    });
  }

  try {
    const googleId = payload.sub;
    const email = payload.email.trim().toLowerCase();
    const name = payload.name && payload.name.trim()
      ? payload.name.trim()
      : email.split('@')[0];

    let user = await User.findOne({ googleId });

    if (!user) {
      user = await User.findOne({ email });
      if (user) {
        if (user.googleId && user.googleId !== googleId) {
          return res.status(401).json({
            success: false,
            message: 'חשבון Google לא תואם למשתמש הקיים',
          });
        }

        if (!user.googleId) {
          user.googleId = googleId;
          await user.save();
        }
      }
    }

    if (!user) {
      const generatedPassword = `${crypto.randomUUID()}Aa1`;
      user = await User.create({
        name,
        email,
        googleId,
        password: generatedPassword,
      });
    }

    const token = generateToken(user._id);
    const response = buildAuthResponse(user);
    response.data.token = token;
    return res.json(response);
  } catch (error) {
    return next(error);
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
        avatarUrl: req.user.avatarUrl || null,
        createdAt: req.user.createdAt,
      },
    },
  });
};

/**
 * @route   POST /api/auth/change-password
 * @desc    שינוי סיסמה למשתמש מחובר
 * @access  Private
 */
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user._id).select('+password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'משתמש לא נמצא',
      });
    }

    if (user.password) {
      if (!currentPassword) {
        return res.status(400).json({
          success: false,
          message: 'סיסמה נוכחית היא שדה חובה',
        });
      }

      const isMatch = await user.matchPassword(currentPassword);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: 'סיסמה נוכחית שגויה',
        });
      }
    }

    user.password = newPassword;
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'הסיסמה עודכנה בהצלחה',
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * @route   POST /api/auth/profile/image
 * @desc    עדכון תמונת פרופיל למשתמש מחובר
 * @access  Private
 */
const updateProfileImage = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'לא נבחר קובץ תמונה',
      });
    }

    const relativePath = `/uploads/profile-images/${req.file.filename}`;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { avatarUrl: relativePath },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'משתמש לא נמצא',
      });
    }

    const response = buildAuthResponse(user);
    return res.status(200).json(response);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  register,
  login,
  googleLogin,
  getMe,
  changePassword,
  updateProfileImage,
};
