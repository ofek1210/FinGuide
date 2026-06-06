const multer = require('multer');
const path = require('path');
const { randomUUID } = require('crypto');
const fs = require('fs');
const { FileUploadError } = require('../utils/appErrors');

const MAX_UPLOAD_SIZE_MB = (() => {
  const raw = Number(process.env.MAX_UPLOAD_SIZE_MB);
  return Number.isFinite(raw) && raw > 0 ? raw : 10;
})();

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
    const uniqueName = `${randomUUID()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

// בדיקת סוג קובץ — PDF ו-XLSX (הר הביטוח)
const ALLOWED_MIMES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
]);
const ALLOWED_EXTS = new Set(['.pdf', '.xlsx', '.xls']);

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname || '').toLowerCase();
  if (ALLOWED_MIMES.has(file.mimetype) || ALLOWED_EXTS.has(ext)) {
    return cb(null, true);
  }
  return cb(new FileUploadError('רק קבצי PDF ו-XLSX מורשים'), false);
};

// הגדרות multer
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_UPLOAD_SIZE_MB * 1024 * 1024,
  },
});

// Middleware לטיפול בשגיאות multer
const handleUploadError = (err, req, res, next) => {
  if (!err) {
    return next();
  }

  if (err instanceof FileUploadError) {
    return next(err);
  }

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return next(
        new FileUploadError(`הקובץ גדול מדי. מקסימום ${MAX_UPLOAD_SIZE_MB}MB`, [
          { code: err.code },
        ])
      );
    }
    return next(
      new FileUploadError('שגיאה בהעלאת הקובץ', [{ code: err.code }])
    );
  }

  return next(err);
};

module.exports = { upload, handleUploadError };
