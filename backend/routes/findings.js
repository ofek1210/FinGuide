const express = require('express');

const router = express.Router();
const { getFindings } = require('../controllers/findingsController');
const { protect } = require('../middleware/auth');

// כל הroutes מוגנים - דורשים authentication
router.use(protect);

// GET /api/findings - קבלת Findings
router.get('/', getFindings);

module.exports = router;
