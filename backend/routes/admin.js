const express = require('express');

const router = express.Router();
const { protect, requireAdmin } = require('../middleware/auth');
const { getAdminStats } = require('../controllers/adminController');

router.use(protect);
router.use(requireAdmin);

// GET /api/admin/stats
router.get('/stats', (req, res, next) => {
  Promise.resolve(getAdminStats(req, res)).catch(next);
});

module.exports = router;
