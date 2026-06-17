const express = require('express');
const { protect } = require('../middleware/auth');
const {
  getCopilotAnalysis,
  updateCopilotProfile,
  upsertGoal,
  deleteGoal,
  generateReport,
} = require('../controllers/copilotController');

const router = express.Router();
router.use(protect);

router.get('/analysis', getCopilotAnalysis);
router.put('/profile', updateCopilotProfile);
router.post('/goals', upsertGoal);
router.put('/goals', upsertGoal);
router.delete('/goals/:id', deleteGoal);
router.post('/monthly-report', generateReport);

module.exports = router;
