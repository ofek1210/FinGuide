'use strict';

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getPensionAnalysis, simulateScenario } = require('../controllers/pensionController');

router.use(protect);

// GET /api/pension/analysis — full pension analysis for the current user
router.get('/analysis', (req, res, next) => {
  Promise.resolve(getPensionAnalysis(req, res)).catch(next);
});

// POST /api/pension/simulate — run a what-if simulation
// Body: { retirementAge, additionalContribution, targetMgmtFee }
router.post('/simulate', (req, res, next) => {
  Promise.resolve(simulateScenario(req, res)).catch(next);
});

module.exports = router;
