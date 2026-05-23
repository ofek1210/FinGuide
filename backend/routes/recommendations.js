const express = require('express');

const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  listRecommendations,
  runRecommendations,
  dismissRecommendation,
  markPurchased,
} = require('../controllers/recommendationsController');

router.use(protect);

router.get('/', listRecommendations);
router.post('/run', runRecommendations);
router.post('/:id/dismiss', dismissRecommendation);
router.post('/:id/purchased', markPurchased);

module.exports = router;
