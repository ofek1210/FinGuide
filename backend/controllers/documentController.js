const fs = require('fs').promises;
const Document = require('../models/Document');
const { FileUploadError, NotFoundError } = require('../utils/appErrors');
const { extractPayslipFile } = require('../services/payslipOcr');

// העלאת מסמך
exports.uploadDocument = async (req, res, next) => {
  try {
    // eslint-disable-next-line no-console
    console.log('[documents] uploadDocument req.user =', req.user);
    // בדוק שקובץ הועלה
    if (!req.file) {
      return next(new FileUploadError('לא נבחר קובץ'));
    }

    // יצירת רשומה במונגו
    let document = await Document.create({
      user: req.user.id,
      originalName: req.file.originalname,
      filename: req.file.filename,
      filePath: req.file.path,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      status: 'processing',
    });

    // ניסיון לבצע חילוץ טקסט ו-OCR (אם יש צורך) ולחלץ נתונים מהתלוש
    try {
      const { data } = await extractPayslipFile(req.file.path);

      document.analysisData = data;
      document.status = 'completed';
      document.processedAt = new Date();
      await document.save();
      // eslint-disable-next-line no-console
      console.log('[documents] uploadDocument extraction result', {
        documentId: document._id,
        summary: document.analysisData?.summary,
      });
    } catch (ocrError) {
      console.error('❌ Document extraction failed for document', document._id, ocrError);
      document.status = 'failed';
      await document.save().catch(() => {});
    }

    const responseBody = {
      success: true,
      data: {
        id: document._id,
        _id: document._id,
        originalName: document.originalName,
        fileSize: document.fileSize,
        uploadedAt: document.uploadedAt,
        status: document.status,
      },
    };
    // eslint-disable-next-line no-console
    console.log('[documents] uploadDocument response', responseBody);
    res.status(201).json(responseBody);
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
    const filter = { user: req.user.id };
    // eslint-disable-next-line no-console
    console.log('[documents] getDocuments req.user =', req.user);
    // eslint-disable-next-line no-console
    console.log('[documents] getDocuments filter =', filter);

    const documents = await Document.find(filter)
      .select('-filePath -__v')
      .sort('-uploadedAt');

    const responseBody = {
      success: true,
      count: documents.length,
      data: documents,
    };
    // eslint-disable-next-line no-console
    console.log('[documents] getDocuments response', {
      count: documents.length,
      firstSummary: documents[0]?.analysisData?.summary,
    });
    res.status(200).json(responseBody);
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

    const responseBody = {
      success: true,
      data: document,
    };
    // eslint-disable-next-line no-console
    console.log('[documents] getDocument response', {
      documentId: document._id,
      summary: document.analysisData?.summary,
    });
    res.status(200).json(responseBody);
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
