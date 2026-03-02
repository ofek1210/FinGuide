const express = require('express');
const {
  parseNumericInput,
  normalizeAmount,
  enforceAmountBounds,
} = require('../utils/numeric');
const { validateSalary } = require('../utils/validateSalary');

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

router.post('/validate-salary', (req, res, next) => {
  try {
    const { grossSalary, netSalary } = req.body || {};
    const validated = validateSalary({ grossSalary, netSalary });

    res.json({
      success: true,
      data: validated,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
