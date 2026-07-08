/**
 * Agent routes — Multi-agent AI system API.
 *
 * Routes:
 * POST /api/agents/ask       — Ask a question to the agent system
 * GET  /api/agents/list      — List available agents
 * POST /api/agents/embed     — Embed a document into the vector store
 * GET  /api/agents/rag/stats — RAG system statistics
 * POST /api/agents/rag/index — Index knowledge base
 */

const express = require('express');

const router = express.Router();
const { protect } = require('../middleware/auth');
const agentController = require('../controllers/agentController');

// All routes require authentication
router.use(protect);

// Agent system
router.post('/ask', agentController.askAgent);
router.get('/list', agentController.listAgents);

// RAG / Embeddings
router.post('/embed', agentController.embedDocument);
router.get('/rag/stats', agentController.getRAGStatus);
router.post('/rag/index', agentController.indexKnowledge);

module.exports = router;
