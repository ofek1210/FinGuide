'use strict';

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');

// Stub — Tax assistant AI (future sprint)
router.get('/status', protect, (req, res) => {
  res.json({ success: true, message: 'Tax assistant coming soon' });
});

module.exports = router;
