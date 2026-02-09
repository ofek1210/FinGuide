const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const { FileUploadError } = require('../utils/appErrors');

// ודא שתיקיית uploads קיימת
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// הגדרת storage
const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, uploadDir);
  },
  filename(req, file, cb) {
    // יצירת שם קובץ ייחודי
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

// בדיקת סוג קובץ
const fileFilter = (req, file, cb) => {
  // רק PDF
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('רק קבצי PDF מורשים'), false);
  }
};

// הגדרות multer
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

// Middleware לטיפול בשגיאות multer
const handleUploadError = (err, req, res, next) => {
  if (!err) {
    return next();
  }

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return next(
        new FileUploadError('הקובץ גדול מדי. מקסימום 10MB', [
          { code: err.code },
        ])
      );
    }

    return next(
      new FileUploadError('שגיאה בהעלאת הקובץ', [{ code: err.code }])
    );
  }

  return next(new FileUploadError(err.message || 'שגיאה בהעלאת הקובץ'));
};

module.exports = { upload, handleUploadError };
