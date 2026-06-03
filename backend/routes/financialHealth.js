const express = require('express');
const { protect } = require('../middleware/auth');
const { getFinancialHealthScore } = require('../controllers/financialHealthController');

const router = express.Router();

router.use(protect);

router.get('/score', getFinancialHealthScore);

module.exports = router;
