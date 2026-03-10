const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const sharp = require('sharp');
const convertHeic = require('heic-convert');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const { AuthError, FileUploadError } = require('../utils/appErrors');
const { sendPasswordResetEmail } = require('../services/mailService');
const {
  hashResetToken,
  createPasswordResetToken,
  buildPasswordResetUrl,
} = require('../services/passwordResetService');

const googleClient = new OAuth2Client();
const PROFILE_IMAGES_DIR = path.join(__dirname, '..', 'uploads', 'profile-images');
const SHARED_GOOGLE_CLIENT_ID =
  '757872744940-rvibdtmd65cif13ia19tm78npjdn8i7l.apps.googleusercontent.com';
const PASSWORD_RESET_SUCCESS_MESSAGE =
  'אם החשבון קיים, שלחנו קישור לאיפוס סיסמה.';

const buildCurrentUserResponse = user => ({
  success: true,
  data: {
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl || null,
      createdAt: user.createdAt,
    },
  },
});

const deleteStoredProfileImage = async avatarUrl => {
  if (!avatarUrl || typeof avatarUrl !== 'string') {
    return;
  }

  const normalizedPrefix = '/uploads/profile-images/';
  if (!avatarUrl.startsWith(normalizedPrefix)) {
    return;
  }

  const filename = path.basename(avatarUrl);
  const targetPath = path.join(PROFILE_IMAGES_DIR, filename);
  const relativeToProfileDir = path.relative(PROFILE_IMAGES_DIR, targetPath);

  if (
    relativeToProfileDir.startsWith('..')
    || path.isAbsolute(relativeToProfileDir)
  ) {
    return;
  }

  await fs.unlink(targetPath).catch(() => {});
};

const isHeicUpload = file => {
  if (!file) {
    return false;
  }

  const ext = path.extname(file.originalname || '').toLowerCase();
  const mime = String(file.mimetype || '').toLowerCase();

  return ext === '.heic'
    || ext === '.heif'
    || mime === 'image/heic'
    || mime === 'image/heif';
};

const normalizeProfileImageBuffer = async file => {
  if (isHeicUpload(file)) {
    return convertHeic({
      buffer: file.buffer,
      format: 'PNG',
    });
  }

  return file.buffer;
};

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

  const googleClientId = process.env.GOOGLE_CLIENT_ID || SHARED_GOOGLE_CLIENT_ID;
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
  res.json(buildCurrentUserResponse(req.user));
};

/**
 * @route   PATCH /api/auth/me
 * @desc    עדכון פרטי משתמש מחובר (שם, אימייל)
 * @access  Private (דורש JWT)
 */
const updateMe = async (req, res, next) => {
  try {
    const { name, email } = req.body || {};

    const updates = {};

    if (typeof name === 'string' && name.trim()) {
      updates.name = name.trim();
    }

    if (typeof email === 'string' && email.trim()) {
      const normalizedEmail = email.trim().toLowerCase();

      const existingUser = await User.findOne({
        email: normalizedEmail,
        _id: { $ne: req.user._id },
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'משתמש עם אימייל זה כבר קיים',
        });
      }

      updates.email = normalizedEmail;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'לא סופקו שדות לעדכון',
      });
    }

    const user = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true,
      runValidators: true,
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'משתמש לא נמצא',
      });
    }

    const response = buildAuthResponse(user);
    return res.json(response);
  } catch (error) {
    return next(error);
  }
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

    if (!currentPassword) {
      return res.status(400).json({
        success: false,
        message: 'סיסמה נוכחית היא שדה חובה',
      });
    }

    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'סיסמה נוכחית שגויה',
      });
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

const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(200).json({
        success: true,
        message: PASSWORD_RESET_SUCCESS_MESSAGE,
      });
    }

    const resetToken = createPasswordResetToken();
    user.passwordResetTokenHash = resetToken.tokenHash;
    user.passwordResetExpiresAt = resetToken.expiresAt;

    try {
      await user.save();

      const resetUrl = buildPasswordResetUrl(resetToken.rawToken);
      await sendPasswordResetEmail({
        to: user.email,
        resetUrl,
        expiresInMinutes: resetToken.expiresInMinutes,
      });
    } catch (error) {
      user.passwordResetTokenHash = null;
      user.passwordResetExpiresAt = null;
      await user.save().catch(() => {});
      return next(error);
    }

    return res.status(200).json({
      success: true,
      message: PASSWORD_RESET_SUCCESS_MESSAGE,
    });
  } catch (error) {
    return next(error);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;
    const tokenHash = hashResetToken(token.trim());

    const user = await User.findOne({
      passwordResetTokenHash: tokenHash,
      passwordResetExpiresAt: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'קישור האיפוס לא תקף או שפג תוקפו',
      });
    }

    user.password = newPassword;
    user.passwordResetTokenHash = null;
    user.passwordResetExpiresAt = null;
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

    const generatedFilename = `${crypto.randomUUID()}.png`;
    const relativePath = `/uploads/profile-images/${generatedFilename}`;
    const outputPath = path.join(PROFILE_IMAGES_DIR, generatedFilename);

    try {
      const inputBuffer = await normalizeProfileImageBuffer(req.file);

      await sharp(inputBuffer)
        .rotate()
        .resize(512, 512, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .png({ compressionLevel: 9 })
        .toFile(outputPath);
    } catch (error) {
      throw new FileUploadError(
        'לא הצלחנו לעבד את קובץ התמונה. נסו קובץ JPG, PNG, WEBP או HEIC.'
      );
    }

    const existingUser = await User.findById(req.user._id);

    if (!existingUser) {
      await fs.unlink(outputPath).catch(() => {});
      return res.status(404).json({
        success: false,
        message: 'משתמש לא נמצא',
      });
    }

    const previousAvatarUrl = existingUser.avatarUrl;
    existingUser.avatarUrl = relativePath;
    await existingUser.save();
    await deleteStoredProfileImage(previousAvatarUrl);

    return res.status(200).json({
      ...buildCurrentUserResponse(existingUser),
      message: 'תמונת הפרופיל עודכנה בהצלחה',
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  register,
  login,
  googleLogin,
  getMe,
  updateMe,
  changePassword,
  forgotPassword,
  resetPassword,
  updateProfileImage,
};
