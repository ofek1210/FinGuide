const express = require('express');

const router = express.Router();

const { chatWithAI, chatWithAIStream, getChatHistoryHandler, listConversations } = require('../controllers/aiController');
const { protect } = require('../middleware/auth');

// כל הroutes כאן מוגנים - דורשים authentication
router.use(protect);

router.post('/chat', (req, res, next) => {
  Promise.resolve(chatWithAI(req, res)).catch(next);
});

// Streaming endpoint — returns Server-Sent Events
router.post('/chat/stream', (req, res, next) => {
  Promise.resolve(chatWithAIStream(req, res)).catch(next);
});

router.get('/chat/history', (req, res, next) => {
  Promise.resolve(getChatHistoryHandler(req, res)).catch(next);
});

router.get('/chat/conversations', (req, res, next) => {
  Promise.resolve(listConversations(req, res)).catch(next);
});

module.exports = router;