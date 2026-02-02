const express = require('express');
const {
  parseNumericInput,
  normalizeAmount,
  enforceAmountBounds,
} = require('../utils/numeric');

const router = express.Router();

router.post('/normalize-number', (req, res) => {
  try {
    const { input } = req.body || {};
    const parsed = parseNumericInput(input);
    const normalized = normalizeAmount(parsed);
    enforceAmountBounds(normalized);

    res.json({
      raw: input,
      parsed,
      normalized,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || 'Invalid numeric input',
    });
  }
});

module.exports = router;
