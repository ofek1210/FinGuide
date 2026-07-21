'use strict';

const express = require('express');
const { protect } = require('../middleware/auth');
const ctrl = require('../controllers/smartOnboardingController');

const router = express.Router();

router.use(protect);

router.get('/general', ctrl.getGeneralState);
router.put('/general', ctrl.saveGeneralAnswers);
router.post('/general/complete', ctrl.completeGeneral);

router.get('/agents/:agentId', ctrl.getAgentState);
router.put('/agents/:agentId', ctrl.saveAgentAnswers);
router.post('/agents/:agentId/complete', ctrl.completeAgent);
router.post('/agents/:agentId/skip', ctrl.skipAgent);
router.get('/agents/:agentId/context', ctrl.getAgentContext);

router.get('/profile', ctrl.getFullProfile);

module.exports = router;
