const express = require('express');
const { protect } = require('../middleware/auth');
const { getTaxAssistantSummary } = require('../controllers/taxAssistantController');

const router = express.Router();

router.use(protect);

router.get('/summary', getTaxAssistantSummary);

module.exports = router;
