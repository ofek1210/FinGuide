const express = require('express');

const router = express.Router();
const {
  uploadDocument,
  getDocuments,
  getDocument,
  deleteDocument,
  downloadDocument,
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

// GET /api/documents/:id - קבלת מסמך בודד
router.get('/:id', getDocument);

// DELETE /api/documents/:id - מחיקת מסמך
router.delete('/:id', deleteDocument);

// GET /api/documents/:id/download - הורדת מסמך
router.get('/:id/download', downloadDocument);

module.exports = router;
