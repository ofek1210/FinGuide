const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/**
 * User Schema
 * מודל משתמש עם הצפנת סיסמה
 */
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'שם הוא שדה חובה'],
      trim: true,
      maxlength: [100, 'שם לא יכול להיות יותר מ-100 תווים'],
    },
    email: {
      type: String,
      required: [true, 'אימייל הוא שדה חובה'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        'אנא הזן אימייל תקין',
      ],
    },
    password: {
      type: String,
      required: [true, 'סיסמה היא שדה חובה'],
      minlength: [6, 'סיסמה חייבת להכיל לפחות 6 תווים'],
      select: false, // לא להחזיר סיסמה בברירת מחדל
    },
  },
  {
    timestamps: true, // מוסיף createdAt ו-updatedAt אוטומטית
  }
);

/**
 * Hash סיסמה לפני שמירה
 */
userSchema.pre('save', async function (next) {
  // אם הסיסמה לא שונתה, דלג
  if (!this.isModified('password')) {
    return next();
  }

  try {
    // Hash עם 10 rounds
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

/**
 * השוואת סיסמה
 * @param {string} enteredPassword - הסיסמה שהוזנה
 * @returns {Promise<boolean>}
 */
userSchema.methods.matchPassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
