const express = require('express');

const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  listInsights,
  dismissInsight,
  runAnalysis,
} = require('../controllers/insightsController');

router.use(protect);

router.get('/', listInsights);
router.post('/run', runAnalysis);
router.post('/:id/dismiss', dismissInsight);

module.exports = router;
