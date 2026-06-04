const express = require('express');

const router = express.Router();
const {
  uploadDocument,
  getDocuments,
  getPayslipHistory,
  getDocument,
  deleteDocument,
  downloadDocument,
  reprocessDocument,
  unlockDocument,
} = require('../controllers/documentController');
const { protect } = require('../middleware/auth');
const { upload, handleUploadError } = require('../middleware/upload');

// כל הroutes מוגנים - דורשים authentication
router.use(protect);

// POST /api/documents/upload - העלאת מסמך
router.post(
  '/upload',
  upload.single('document'),
  handleUploadError,
  uploadDocument
);

// GET /api/documents - קבלת כל המסמכים
router.get('/', getDocuments);

// GET /api/documents/payslip-history - תובנות תלושים לפי שנה/חודש
router.get('/payslip-history', getPayslipHistory);

// GET /api/documents/:id/download - הורדת מסמך (לפני /:id כדי שלא יתפוס "id/download")
router.get('/:id/download', downloadDocument);

// POST /api/documents/:id/reprocess - הרצה מחדש של חילוץ על הקובץ הקיים
router.post('/:id/reprocess', reprocessDocument);

// POST /api/documents/:id/unlock - פתיחת PDF מוגן בסיסמה והמשך עיבוד
router.post('/:id/unlock', unlockDocument);

// GET /api/documents/:id - קבלת מסמך בודד
router.get('/:id', getDocument);

// DELETE /api/documents/:id - מחיקת מסמך
router.delete('/:id', deleteDocument);

module.exports = router;
