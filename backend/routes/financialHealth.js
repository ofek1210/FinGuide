'use strict';

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');

// Stub — Financial health score (future sprint)
router.get('/score', protect, (req, res) => {
  res.json({ success: true, message: 'Financial health score coming soon' });
});

module.exports = router;
