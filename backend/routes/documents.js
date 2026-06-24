const express = require('express');

const router = express.Router();
const {
  uploadDocument,
  getDocuments,
  getPayslipHistory,
  getRecentPayslips,
  getDocument,
  deleteDocument,
  downloadDocument,
  reprocessDocument,
  unlockDocument,
  updateDocumentFields,
  getDocumentDigest,
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

// GET /api/documents/recent-payslips - N תלושים אחרונים לפי תקופת שכר
router.get('/recent-payslips', getRecentPayslips);

// GET /api/documents/ai-insights — AI insights based on profile + recent payslips
router.get('/ai-insights', async (req, res, next) => {
  try {
    const { getPayslipInsights } = require('../services/payslipInsightsService');
    const result = await getPayslipInsights(req.user._id);
    return res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

// GET /api/documents/:id/download - הורדת מסמך (לפני /:id כדי שלא יתפוס "id/download")
router.get('/:id/download', downloadDocument);

router.get('/:id/digest', getDocumentDigest);

// POST /api/documents/:id/reprocess - הרצה מחדש של חילוץ על הקובץ הקיים
router.post('/:id/reprocess', reprocessDocument);

// POST /api/documents/:id/unlock - פתיחת PDF מוגן בסיסמה והמשך עיבוד
router.post('/:id/unlock', unlockDocument);

// PATCH /api/documents/:id/fields - השלמה ידנית של שדות שה-OCR לא חילץ
router.patch('/:id/fields', updateDocumentFields);

// GET /api/documents/:id - קבלת מסמך בודד
router.get('/:id', getDocument);

// DELETE /api/documents/:id - מחיקת מסמך
router.delete('/:id', deleteDocument);

module.exports = router;
