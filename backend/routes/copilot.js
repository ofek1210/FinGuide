'use strict';

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');

// Stub — Financial copilot multi-agent chat (future sprint)
router.post('/chat', protect, (req, res) => {
  res.json({ success: true, message: 'Financial copilot coming soon' });
});

module.exports = router;
