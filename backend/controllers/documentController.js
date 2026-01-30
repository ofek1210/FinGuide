const fs = require('fs').promises;
const Document = require('../models/Document');

// העלאת מסמך
exports.uploadDocument = async (req, res, next) => {
  try {
    // בדוק שקובץ הועלה
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'לא נבחר קובץ',
      });
    }

    // יצירת רכורד במונגו
    const document = await Document.create({
      user: req.user.id,
      originalName: req.file.originalname,
      filename: req.file.filename,
      filePath: req.file.path,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
    });

    res.status(201).json({
      success: true,
      message: 'הקובץ הועלה בהצלחה',
      data: {
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
    const document = await Document.findById(req.params.id);

    // בדיקה שהמסמך קיים
    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'מסמך לא נמצא',
      });
    }

    // בדיקה שהמסמך שייך למשתמש
    if (document.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'אין הרשאה לגשת למסמך זה',
      });
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
    const document = await Document.findById(req.params.id);

    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'מסמך לא נמצא',
      });
    }

    // בדיקה שהמסמך שייך למשתמש
    if (document.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'אין הרשאה למחוק מסמך זה',
      });
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
    const document = await Document.findById(req.params.id);

    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'מסמך לא נמצא',
      });
    }

    if (document.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'אין הרשאה להוריד מסמך זה',
      });
    }

    // שליחת הקובץ
    res.download(document.filePath, document.originalName);
  } catch (error) {
    next(error);
  }
};
