'use strict';

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { body } = require('express-validator');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  getPensionAnalysis,
  getImportHistory,
  simulateScenario,
  uploadPensionData,
  uploadPensionFile,
  uploadFreePreview,
  completeManualFunds,
  uploadClearinghouse,
  updatePensionFund,
  deletePensionFund,
  getFundAdvice,
  getLeadingFunds,
  getMarketFundById,
  getPensionRecommendations,
  deleteAllPensionData,
  analyzePensionOnly,
} = require('../controllers/pensionController');
const { getPensionInsights } = require('../services/pensionRiskAdvisor');

const fileUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const allowed = ['.xlsx', '.xls', '.pdf'];
    if (req.query?.importSource === 'quarterly_report') {
      allowed.push('.txt');
    }
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('PDF או Excel בלבד (.pdf/.xlsx/.xls)'));
    }
  },
});

router.use(protect);

router.get('/analysis', (req, res, next) => {
  Promise.resolve(getPensionAnalysis(req, res)).catch(next);
});

router.get('/import-history', (req, res, next) => {
  Promise.resolve(getImportHistory(req, res)).catch(next);
});

router.post('/simulate', (req, res, next) => {
  Promise.resolve(simulateScenario(req, res)).catch(next);
});

router.post('/upload', (req, res, next) => {
  Promise.resolve(uploadPensionData(req, res)).catch(next);
});

router.post('/upload-file', fileUpload.single('file'), (req, res, next) => {
  Promise.resolve(uploadPensionFile(req, res)).catch(next);
});

router.post('/upload-free-preview', fileUpload.single('file'), (req, res, next) => {
  Promise.resolve(uploadFreePreview(req, res)).catch(next);
});

router.post('/upload-clearinghouse', fileUpload.single('file'), (req, res, next) => {
  Promise.resolve(uploadClearinghouse(req, res)).catch(next);
});

router.post('/complete-manual-funds', (req, res, next) => {
  Promise.resolve(completeManualFunds(req, res)).catch(next);
});

router.get('/funds', (req, res, next) => {
  Promise.resolve(uploadPensionData(req, res, true)).catch(next);
});

router.delete('/funds/:id', (req, res, next) => {
  Promise.resolve(deletePensionFund(req, res)).catch(next);
});

router.patch('/funds/:id', (req, res, next) => {
  Promise.resolve(updatePensionFund(req, res)).catch(next);
});

router.delete('/funds', (req, res, next) => {
  Promise.resolve(deleteAllPensionData(req, res)).catch(next);
});

router.get('/risk-advice', async (req, res, next) => {
  try {
    const result = await getPensionInsights(req.user._id);
    return res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

router.get('/fund-advice', (req, res, next) => {
  Promise.resolve(getFundAdvice(req, res)).catch(next);
});

router.post(
  '/analyze-pension-only',
  [
    body('products')
      .isArray({ min: 1 })
      .withMessage('products חייב להיות מערך עם לפחות מוצר אחד'),
  ],
  validate,
  (req, res, next) => {
    Promise.resolve(analyzePensionOnly(req, res)).catch(next);
  },
);

router.post(
  '/recommendations',
  [
    body('currentFundId')
      .trim()
      .notEmpty()
      .withMessage('currentFundId הוא שדה חובה'),
    body('userManagementFee')
      .isFloat({ min: 0, max: 10 })
      .withMessage('userManagementFee חייב להיות אחוז בין 0 ל-10'),
    body('riskPreference')
      .isIn(['low', 'medium', 'high'])
      .withMessage('riskPreference חייב להיות low, medium או high'),
  ],
  validate,
  (req, res, next) => {
    Promise.resolve(getPensionRecommendations(req, res)).catch(next);
  },
);

router.get('/leading-funds', (req, res, next) => {
  Promise.resolve(getLeadingFunds(req, res)).catch(next);
});

router.get('/fund/:id', (req, res, next) => {
  Promise.resolve(getMarketFundById(req, res)).catch(next);
});

module.exports = router;
