const express = require('express');

const router = express.Router();

const {
  chatWithAI,
  chatWithAIStream,
  getChatHistoryHandler,
  listConversations,
  deleteConversation,
  renameConversation,
  submitMessageFeedback,
  getFinancialTips,
} = require('../controllers/aiController');
const { runFullAnalysisHandler } = require('../controllers/fullAnalysisController');
const { protect } = require('../middleware/auth');
const { chatRateLimiter } = require('../middleware/chatRateLimit');

// כל הroutes כאן מוגנים - דורשים authentication
router.use(protect);

router.post('/chat', chatRateLimiter, (req, res, next) => {
  Promise.resolve(chatWithAI(req, res)).catch(next);
});

// Streaming endpoint — returns Server-Sent Events
router.post('/chat/stream', chatRateLimiter, (req, res, next) => {
  Promise.resolve(chatWithAIStream(req, res)).catch(next);
});

router.get('/chat/history', (req, res, next) => {
  Promise.resolve(getChatHistoryHandler(req, res)).catch(next);
});

router.get('/chat/conversations', (req, res, next) => {
  Promise.resolve(listConversations(req, res)).catch(next);
});

router.delete('/chat/conversations/:id', (req, res, next) => {
  Promise.resolve(deleteConversation(req, res)).catch(next);
});

router.patch('/chat/conversations/:id', (req, res, next) => {
  Promise.resolve(renameConversation(req, res)).catch(next);
});

router.post('/chat/messages/:id/feedback', (req, res, next) => {
  Promise.resolve(submitMessageFeedback(req, res)).catch(next);
});

// AI-generated personalized financial tips for dashboard
router.get('/financial-tips', (req, res, next) => {
  Promise.resolve(getFinancialTips(req, res)).catch(next);
});

// Multi-agent full analysis — runs all agents in parallel
router.post('/full-analysis', (req, res, next) => {
  Promise.resolve(runFullAnalysisHandler(req, res)).catch(next);
});

module.exports = router;
