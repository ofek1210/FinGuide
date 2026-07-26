/**
 * Gemel routes — קופות גמל וקרנות השתלמות.
 *
 * Routes:
 * GET    /api/gemel/analysis      — full gemel analysis (summary + market + findings)
 * GET    /api/gemel/agent         — agent result (incl. optional LLM explanation)
 * GET    /api/gemel/funds         — list gemel-type holdings
 * POST   /api/gemel/funds         — manual gemel fund entry
 * PATCH  /api/gemel/funds/:id     — update a holding
 * DELETE /api/gemel/funds/:id     — remove a holding
 * GET    /api/gemel/leading-funds — official GemelNet market comparison (product, risk, period)
 */

const express = require('express');
const multer = require('multer');

const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getGemelAnalysis,
  getGemelAgentResult,
  listGemelFunds,
  createGemelFund,
  updateGemelFund,
  deleteGemelFund,
  getGemelLeadingFunds,
  uploadGemelExcel,
  analyzeGemel,
  getGemelReport,
  downloadGemelReportPdf,
} = require('../controllers/gemelController');

const fileUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /\.(xlsx|xls|csv)$/i.test(file.originalname || '');
    cb(ok ? null : new Error('רק קבצי Excel/CSV'), ok);
  },
});

router.use(protect);

router.get('/analysis', (req, res, next) => {
  Promise.resolve(getGemelAnalysis(req, res)).catch(next);
});

router.get('/agent', (req, res, next) => {
  Promise.resolve(getGemelAgentResult(req, res)).catch(next);
});

router.get('/funds', (req, res, next) => {
  Promise.resolve(listGemelFunds(req, res)).catch(next);
});

router.post('/funds', (req, res, next) => {
  Promise.resolve(createGemelFund(req, res)).catch(next);
});

router.patch('/funds/:id', (req, res, next) => {
  Promise.resolve(updateGemelFund(req, res)).catch(next);
});

router.delete('/funds/:id', (req, res, next) => {
  Promise.resolve(deleteGemelFund(req, res)).catch(next);
});

router.get('/leading-funds', (req, res, next) => {
  Promise.resolve(getGemelLeadingFunds(req, res)).catch(next);
});

router.post('/upload', fileUpload.single('file'), (req, res, next) => {
  Promise.resolve(uploadGemelExcel(req, res)).catch(next);
});

router.post('/analyze', (req, res, next) => {
  Promise.resolve(analyzeGemel(req, res)).catch(next);
});

router.get('/report', (req, res, next) => {
  Promise.resolve(getGemelReport(req, res)).catch(next);
});

router.get('/report/pdf', (req, res, next) => {
  Promise.resolve(downloadGemelReportPdf(req, res)).catch(next);
});

module.exports = router;
