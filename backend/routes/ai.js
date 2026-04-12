const express = require('express');

const router = express.Router();

const { chatWithAI } = require('../controllers/aiController');
const { protect } = require('../middleware/auth');

// כל הroutes כאן מוגנים - דורשים authentication
router.use(protect);

router.post('/chat', (req, res, next) => {
  Promise.resolve(chatWithAI(req, res)).catch(next);
});

module.exports = router;