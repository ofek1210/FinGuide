'use strict';

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getDashboardSummary } = require('../controllers/dashboardController');

router.use(protect);

// GET /api/dashboard/summary
router.get('/summary', (req, res, next) => {
  Promise.resolve(getDashboardSummary(req, res)).catch(next);
});

module.exports = router;
