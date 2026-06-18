'use strict';

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');

// Stub — Gmail OAuth integration (future sprint)
router.get('/status', protect, (req, res) => {
  res.json({ success: true, connected: false, message: 'Gmail integration coming soon' });
});

module.exports = router;
