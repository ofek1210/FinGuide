const fs = require('fs').promises;
const Document = require('../models/Document');
const { FileUploadError } = require('../utils/appErrors');

// העלאת מסמך
exports.uploadDocument = async (req, res, next) => {
  try {
    // בדוק שקובץ הועלה
    if (!req.file) {
      return next(new FileUploadError('לא נבחר קובץ'));
    }

    // יצירת רכורד במונגו
    const document = await Document.create({
      user: req.user.id,
      originalName: req.file.originalname,
      filename: req.file.filename,
      filePath: req.file.path,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      // ברירת מחדל: pending (עולה מתוך הסכמה)
    });

    res.status(201).json({
      success: true,
      data: {
        id: document._id,
        _id: document._id,
        originalName: document.originalName,
        fileSize: document.fileSize,
        uploadedAt: document.uploadedAt,
        status: document.status,
      },
    });
  } catch (error) {
    // אם נכשל, מחק את הקובץ
    if (req.file) {
      await fs.unlink(req.file.path).catch(err => console.error(err));
    }
    next(error);
  }
};

// קבלת כל המסמכים של משתמש
exports.getDocuments = async (req, res, next) => {
  try {
    const documents = await Document.find({ user: req.user.id })
      .select('-filePath -__v')
      .sort('-uploadedAt');

    res.status(200).json({
      success: true,
      count: documents.length,
      data: documents,
    });
  } catch (error) {
    next(error);
  }
};

// קבלת מסמך בודד
exports.getDocument = async (req, res, next) => {
  try {
    const document = await Document.findOne({
      _id: req.params.id,
      user: req.user.id,
    });

    if (!document) {
      return next(new NotFoundError('מסמך לא נמצא'));
    }

    res.status(200).json({
      success: true,
      data: document,
    });
  } catch (error) {
    next(error);
  }
};

// מחיקת מסמך
exports.deleteDocument = async (req, res, next) => {
  try {
    const document = await Document.findOne({
      _id: req.params.id,
      user: req.user.id,
    });

    if (!document) {
      return next(new NotFoundError('מסמך לא נמצא'));
    }

    // מחיקת הקובץ מהדיסק
    await fs.unlink(document.filePath).catch(err => {
      console.error('שגיאה במחיקת קובץ:', err);
    });

    // מחיקה מהמסד נתונים
    await document.deleteOne();

    res.status(200).json({
      success: true,
      message: 'המסמך נמחק בהצלחה',
    });
  } catch (error) {
    next(error);
  }
};

// הורדת מסמך
exports.downloadDocument = async (req, res, next) => {
  try {
    const document = await Document.findOne({
      _id: req.params.id,
      user: req.user.id,
    });

    if (!document) {
      return next(new NotFoundError('מסמך לא נמצא'));
    }

    // שליחת הקובץ
    res.download(document.filePath, document.originalName);
  } catch (error) {
    next(error);
  }
};
