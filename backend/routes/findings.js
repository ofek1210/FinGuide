const express = require('express');

const router = express.Router();
const {
  getFindings,
  getSavingsForecast,
} = require('../controllers/findingsController');
const { protect } = require('../middleware/auth');

// כל הroutes מוגנים - דורשים authentication
router.use(protect);

// POST /api/findings/savings-forecast - חישוב תחזית חיסכון לינארית
router.post('/savings-forecast', getSavingsForecast);

// GET /api/findings - קבלת Findings
router.get('/', getFindings);

module.exports = router;
