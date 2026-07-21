const express = require('express');

const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  generateExecutiveReport,
  getLatestExecutiveReportHandler,
  downloadExecutiveReportPdf,
} = require('../controllers/executiveReportController');

router.use(protect);

router.post('/report', (req, res, next) => {
  Promise.resolve(generateExecutiveReport(req, res)).catch(next);
});

router.get('/report/latest', (req, res, next) => {
  Promise.resolve(getLatestExecutiveReportHandler(req, res)).catch(next);
});

router.get('/report/pdf', (req, res, next) => {
  Promise.resolve(downloadExecutiveReportPdf(req, res)).catch(next);
});

module.exports = router;
