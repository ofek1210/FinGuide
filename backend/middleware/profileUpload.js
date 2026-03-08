const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { randomUUID } = require('crypto');
const { FileUploadError } = require('../utils/appErrors');

const MAX_PROFILE_IMAGE_MB = (() => {
  const raw = Number(process.env.MAX_PROFILE_IMAGE_MB);
  return Number.isFinite(raw) && raw > 0 ? raw : 2;
})();

const profileImagesDir = path.join(__dirname, '..', 'uploads', 'profile-images');
if (!fs.existsSync(profileImagesDir)) {
  fs.mkdirSync(profileImagesDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, profileImagesDir);
  },
  filename(req, file, cb) {
    const uniqueName = `${randomUUID()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png'];
const allowedExtensions = ['.jpg', '.jpeg', '.png'];

const fileFilter = (req, file, cb) => {
  const mimeOk = allowedMimeTypes.includes(file.mimetype);
  const ext = path.extname(file.originalname || '').toLowerCase();
  const extOk = allowedExtensions.includes(ext);

  if (mimeOk && extOk) {
    return cb(null, true);
  }

  return cb(new FileUploadError('רק קבצי תמונה מסוג JPG/PNG מורשים'), false);
};

const profileUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_PROFILE_IMAGE_MB * 1024 * 1024,
  },
});

const handleProfileUploadError = (err, req, res, next) => {
  if (!err) {
    return next();
  }

  if (err instanceof FileUploadError) {
    return next(err);
  }

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return next(
        new FileUploadError(
          `קובץ התמונה גדול מדי. מקסימום ${MAX_PROFILE_IMAGE_MB}MB`,
          [{ code: err.code }]
        )
      );
    }
    return next(
      new FileUploadError('שגיאה בהעלאת תמונת הפרופיל', [{ code: err.code }])
    );
  }

  return next(err);
};

module.exports = {
  profileUpload,
  handleProfileUploadError,
};
