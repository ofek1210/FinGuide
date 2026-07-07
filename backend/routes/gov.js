'use strict';

const router = require('express').Router();
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
} = require('../controllers/govController');

router.use(protect);

/** GET /api/gov/status — fund counts + last sync per net */
router.get('/status', (req, res, next) => {
  Promise.resolve(getGovStatus(req, res)).catch(next);
});

/** POST /api/gov/sync — trigger pensia + gemel + bituah sync */
router.post('/sync', (req, res, next) => {
  Promise.resolve(postGovSync(req, res)).catch(next);
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
