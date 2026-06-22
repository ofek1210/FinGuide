'use strict';

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { protect } = require('../middleware/auth');
const {
  getPensionAnalysis,
  getImportHistory,
  simulateScenario,
  uploadPensionData,
  uploadPensionFile,
  updatePensionFund,
  deletePensionFund,
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

router.get('/funds', (req, res, next) => {
  Promise.resolve(uploadPensionData(req, res, true)).catch(next);
});

router.delete('/funds/:id', (req, res, next) => {
  Promise.resolve(deletePensionFund(req, res)).catch(next);
});

router.patch('/funds/:id', (req, res, next) => {
  Promise.resolve(updatePensionFund(req, res)).catch(next);
});

router.delete('/funds', async (req, res, next) => {
  try {
    const PensionFund = require('../models/PensionFund');
    await PensionFund.deleteMany({ user: req.user._id, source: 'manual' });
    return res.json({ success: true, message: 'כל נתוני הפנסיה הידניים נמחקו' });
  } catch (err) { next(err); }
});

router.get('/risk-advice', async (req, res, next) => {
  try {
    const result = await getPensionInsights(req.user._id);
    return res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

module.exports = router;
