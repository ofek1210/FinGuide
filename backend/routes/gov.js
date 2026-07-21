'use strict';

const router = require('express').Router();
const multer = require('multer');
const { protect } = require('../middleware/auth');
const {
  getGovStatus,
  postGovSync,
  postNetSync,
  getNetStatus,
  getFunds,
  getFundById,
  getLeadingFunds,
  getGemelAdvice,
  getBituahAdvice,
  getPayslipBenchmarks,
  postPensiaCohortAnnual,
  getPensiaCohortAnnual,
  postGemelCohortAnnual,
  getGemelCohortAnnual,
} = require('../controllers/govController');

const excelUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /\.(xls|xlsx)$/i.test(file.originalname || '');
    cb(ok ? null : new Error('רק קבצי Excel'), ok);
  },
});

router.use(protect);

/** GET /api/gov/status — fund counts + last sync per net */
router.get('/status', (req, res, next) => {
  Promise.resolve(getGovStatus(req, res)).catch(next);
});

/** POST /api/gov/sync — trigger full market sync (pensia + gemel + bituah + tracks + cohort) */
router.post('/sync', (req, res, next) => {
  Promise.resolve(postGovSync(req, res)).catch(next);
});

/** POST /api/gov/sync-all — alias for full sync including cohort macro tables */
router.post('/sync-all', (req, res, next) => {
  Promise.resolve(postGovSyncAll(req, res)).catch(next);
});

/** GET /api/gov/gemel/advice — personalized gemel/study fund advice */
router.get('/gemel/advice', (req, res, next) => {
  Promise.resolve(getGemelAdvice(req, res)).catch(next);
});

/** GET /api/gov/bituah/advice — personalized life-track advice */
router.get('/bituah/advice', (req, res, next) => {
  Promise.resolve(getBituahAdvice(req, res)).catch(next);
});

/** GET /api/gov/payslip/benchmarks — payslip × gov market recommendations */
router.get('/payslip/benchmarks', (req, res, next) => {
  Promise.resolve(getPayslipBenchmarks(req, res)).catch(next);
});

/** GET /api/gov/pensia/cohort-annual — imported macro annual returns by fund type */
router.get('/pensia/cohort-annual', (req, res, next) => {
  Promise.resolve(getPensiaCohortAnnual(req, res)).catch(next);
});

/** POST /api/gov/pensia/cohort-annual — import tsuotHodPtihaRDL.xls from Pensia-Net UI */
router.post('/pensia/cohort-annual', excelUpload.single('file'), (req, res, next) => {
  Promise.resolve(postPensiaCohortAnnual(req, res)).catch(next);
});

/** GET /api/gov/gemel/cohort-annual — imported macro annual returns by fund type */
router.get('/gemel/cohort-annual', (req, res, next) => {
  Promise.resolve(getGemelCohortAnnual(req, res)).catch(next);
});

/** POST /api/gov/gemel/cohort-annual — import tsuotHodPtihaRDL.xls from Gemel-Net UI */
router.post('/gemel/cohort-annual', excelUpload.single('file'), (req, res, next) => {
  Promise.resolve(postGemelCohortAnnual(req, res)).catch(next);
});

/** GET /api/gov/:net/status — single net sync meta */
router.get('/:net/status', (req, res, next) => {
  Promise.resolve(getNetStatus(req, res)).catch(next);
});

/** POST /api/gov/:net/sync — sync single net (pensia | gemel | bituah) */
router.post('/:net/sync', (req, res, next) => {
  Promise.resolve(postNetSync(req, res)).catch(next);
});

/** GET /api/gov/:net/funds — paginated market funds */
router.get('/:net/funds', (req, res, next) => {
  Promise.resolve(getFunds(req, res)).catch(next);
});

/** GET /api/gov/:net/funds/leading — top performers */
router.get('/:net/funds/leading', (req, res, next) => {
  Promise.resolve(getLeadingFunds(req, res)).catch(next);
});

/** GET /api/gov/:net/funds/:id — single fund metrics */
router.get('/:net/funds/:id', (req, res, next) => {
  Promise.resolve(getFundById(req, res)).catch(next);
});

module.exports = router;
