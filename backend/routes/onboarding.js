const express = require('express');

const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getOnboarding,
  updateOnboarding,
  completeOnboarding,
  getOnboardingStatus,
} = require('../controllers/onboardingController');

router.use(protect);

// GET /api/onboarding
router.get('/', getOnboarding);

// PUT /api/onboarding (partial draft update)
router.put('/', updateOnboarding);

// POST /api/onboarding/complete
router.post('/complete', completeOnboarding);

// GET /api/onboarding/status
router.get('/status', getOnboardingStatus);

module.exports = router;

