const express = require('express');

const router = express.Router();
const {
  getDocuments,
  getDocument,
  deleteDocument,
  downloadDocument,
} = require('../controllers/documentCrudController');
const {
  getPayslipHistory,
  getPayslipDetail,
} = require('../controllers/documentPayslipController');
const {
  uploadDocument,
  retryDocumentProcessing,
} = require('../controllers/documentProcessingController');
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

// GET /api/documents/payslips - קבלת היסטוריית תלושים קנונית
router.get('/payslips', getPayslipHistory);

// GET /api/documents/payslips/:id - קבלת פירוט תלוש קנוני
router.get('/payslips/:id', getPayslipDetail);

// GET /api/documents/:id/download - הורדת מסמך (לפני /:id כדי שלא יתפוס "id/download")
router.get('/:id/download', downloadDocument);

// POST /api/documents/:id/reprocess - בקשת עיבוד מחדש למסמך
router.post('/:id/reprocess', retryDocumentProcessing);

// GET /api/documents/:id - קבלת מסמך בודד
router.get('/:id', getDocument);

// DELETE /api/documents/:id - מחיקת מסמך
router.delete('/:id', deleteDocument);

module.exports = router;
