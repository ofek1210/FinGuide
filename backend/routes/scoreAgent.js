const express = require('express');

const router = express.Router();
const { getGaps, submitAnswer } = require('../controllers/scoreAgentController');
const { protect } = require('../middleware/auth');

router.use(protect);

// GET /api/score-agent/gaps - actionable gaps + current score for the year
router.get('/gaps', getGaps);

// POST /api/score-agent/answer - persist a user-provided field value, return updated score
router.post('/answer', submitAnswer);

module.exports = router;
