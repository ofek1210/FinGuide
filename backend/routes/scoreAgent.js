'use strict';

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');

// Stub — AI score agent (future sprint)
router.get('/scores', protect, (req, res) => {
  res.json({ success: true, message: 'Score agent coming soon' });
});

module.exports = router;
