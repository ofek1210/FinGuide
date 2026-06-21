'use strict';

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getPensionAnalysis, simulateScenario, uploadPensionData, deletePensionFund } = require('../controllers/pensionController');
const { getPensionInsights } = require('../services/pensionRiskAdvisor');

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

// POST /api/pension/upload — save manual pension fund data
// Body: { fundName, fundType, provider, currentBalance, monthlyEmployeeDeposit, monthlyEmployerDeposit, managementFeeAccumulation, managementFeeDeposit }
router.post('/upload', (req, res, next) => {
  Promise.resolve(uploadPensionData(req, res)).catch(next);
});

// GET /api/pension/funds — list saved pension funds
router.get('/funds', (req, res, next) => {
  Promise.resolve(uploadPensionData(req, res, true)).catch(next);
});

// DELETE /api/pension/funds/:id — delete a specific fund
router.delete('/funds/:id', (req, res, next) => {
  Promise.resolve(deletePensionFund(req, res)).catch(next);
});

// DELETE /api/pension/funds — delete ALL manual funds for the user
router.delete('/funds', async (req, res, next) => {
  try {
    const PensionFund = require('../models/PensionFund');
    await PensionFund.deleteMany({ user: req.user._id, source: 'manual' });
    return res.json({ success: true, message: 'כל נתוני הפנסיה הידניים נמחקו' });
  } catch (err) { next(err); }
});

// GET /api/pension/risk-advice — AI risk level + fee analysis based on profile
router.get('/risk-advice', async (req, res, next) => {
  try {
    const result = await getPensionInsights(req.user._id);
    return res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

module.exports = router;
