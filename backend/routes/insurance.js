

const express = require('express');

const router = express.Router();
const multer = require('multer');
const path = require('path');
const { protect } = require('../middleware/auth');
const {
  getInsuranceAnalysis,
  uploadInsuranceExcel,
  getInsurancePolicies,
  getInsuranceImportHistory,
  deleteInsurancePolicy,
  getMarketAdvice,
  getInsuranceOnboardingSession,
  postInsuranceOnboardingAnswer,
  postInsuranceOnboardingComplete,
} = require('../controllers/insuranceController');
const { getInsuranceInsights } = require('../services/insuranceProfileAnalyzer');

// Excel upload — memory storage (no file saved to disk)
const excelUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.xlsx', '.xls'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('קובץ Excel בלבד (.xlsx/.xls)'));
    }
  },
});

router.use(protect);

// GET /api/insurance/analysis — full AI analysis from profile + imported policies
router.get('/analysis', (req, res, next) => {
  Promise.resolve(getInsuranceAnalysis(req, res)).catch(next);
});

// GET /api/insurance/policies — list all imported policies for the user
router.get('/policies', (req, res, next) => {
  Promise.resolve(getInsurancePolicies(req, res)).catch(next);
});

router.get('/import-history', (req, res, next) => {
  Promise.resolve(getInsuranceImportHistory(req, res)).catch(next);
});

// POST /api/insurance/upload-excel — parse Har HaBituach Excel
router.post('/upload-excel', excelUpload.single('file'), (req, res, next) => {
  Promise.resolve(uploadInsuranceExcel(req, res, next)).catch(next);
});

// DELETE /api/insurance/policies/:id
router.delete('/policies/:id', (req, res, next) => {
  Promise.resolve(deleteInsurancePolicy(req, res)).catch(next);
});

// GET /api/insurance/profile-insights — AI profile-based analysis
router.get('/profile-insights', async (req, res, next) => {
  try {
    const result = await getInsuranceInsights(req.user._id);
    return res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

router.get('/market-advice', (req, res, next) => {
  Promise.resolve(getMarketAdvice(req, res)).catch(next);
});

// Smart onboarding — dynamic Q&A after Har HaBituach import
router.get('/onboarding/session', (req, res, next) => {
  Promise.resolve(getInsuranceOnboardingSession(req, res)).catch(next);
});

router.post('/onboarding/answer', (req, res, next) => {
  Promise.resolve(postInsuranceOnboardingAnswer(req, res)).catch(next);
});

router.post('/onboarding/complete', (req, res, next) => {
  Promise.resolve(postInsuranceOnboardingComplete(req, res)).catch(next);
});

// DELETE /api/insurance/data — delete Har HaBituach imported policies only
router.delete('/data', async (req, res, next) => {
  try {
    const InsurancePolicy = require('../models/InsurancePolicy');
    const result = await InsurancePolicy.deleteMany({ user: req.user._id, source: 'har_bituach' });
    return res.json({
      success: true,
      message: 'דוח הר הביטוח נמחק',
      data: { deletedCount: result.deletedCount },
    });
  } catch (err) { next(err); }
});

// DELETE /api/insurance/onboarding — reset insurance agent onboarding only
router.delete('/onboarding', async (req, res, next) => {
  try {
    const { resetOnboarding } = require('../services/insuranceOnboardingService');
    await resetOnboarding(req.user._id);
    return res.json({ success: true, message: 'נתוני האונבורדינג של הביטוח נמחקו' });
  } catch (err) { next(err); }
});

module.exports = router;
