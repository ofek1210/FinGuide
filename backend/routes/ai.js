const express = require('express');

const router = express.Router();

const { chatWithAI, chatWithAIStream, getChatHistoryHandler, listConversations, getFinancialTips } = require('../controllers/aiController');
const { runFullAnalysisHandler } = require('../controllers/fullAnalysisController');
const { runDebateHandler, streamDebateHandler } = require('../controllers/debateController');
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

// AI-generated personalized financial tips for dashboard
router.get('/financial-tips', (req, res, next) => {
  Promise.resolve(getFinancialTips(req, res)).catch(next);
});

// Multi-agent full analysis — runs all agents in parallel
router.post('/full-analysis', (req, res, next) => {
  Promise.resolve(runFullAnalysisHandler(req, res)).catch(next);
});

// Agent debate council — agents argue priorities, judge ranks them (SSE stream)
router.post('/debate', (req, res, next) => {
  Promise.resolve(runDebateHandler(req, res)).catch(next);
});

router.post('/debate/stream', (req, res, next) => {
  Promise.resolve(streamDebateHandler(req, res)).catch(next);
});

module.exports = router;