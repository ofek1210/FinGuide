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
 * GET    /api/gemel/leading-funds — top Gemel-Net market funds
 */

const express = require('express');

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
} = require('../controllers/gemelController');

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

module.exports = router;
