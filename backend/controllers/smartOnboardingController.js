'use strict';

const UserProfile = require('../models/UserProfile');
const { VALID_AGENTS } = require('../config/smartOnboardingConfig');
const smartOnboarding = require('../services/smartOnboarding/smartOnboardingService');

exports.getGeneralState = async (req, res, next) => {
  try {
    const state = await smartOnboarding.getState(req.user._id, 'general');
    return res.json({ success: true, data: state });
  } catch (err) {
    return next(err);
  }
};

exports.saveGeneralAnswers = async (req, res, next) => {
  try {
    const answers = req.body?.answers || {};
    await smartOnboarding.saveAnswers(req.user._id, 'general', answers);
    const state = await smartOnboarding.getState(req.user._id, 'general');
    return res.json({ success: true, data: state });
  } catch (err) {
    return next(err);
  }
};

exports.completeGeneral = async (req, res, next) => {
  try {
    const answers = req.body?.answers || {};
    if (Object.keys(answers).length) {
      await smartOnboarding.saveAnswers(req.user._id, 'general', answers);
    }
    await smartOnboarding.completeLayer(req.user._id, 'general');
    const state = await smartOnboarding.getState(req.user._id, 'general');
    return res.json({ success: true, data: state });
  } catch (err) {
    return next(err);
  }
};

exports.getAgentState = async (req, res, next) => {
  try {
    const { agentId } = req.params;
    if (!VALID_AGENTS.includes(agentId)) {
      return res.status(400).json({ success: false, message: 'סוכן לא נתמך' });
    }
    const state = await smartOnboarding.getState(req.user._id, agentId);
    return res.json({ success: true, data: state });
  } catch (err) {
    return next(err);
  }
};

exports.saveAgentAnswers = async (req, res, next) => {
  try {
    const { agentId } = req.params;
    const answers = req.body?.answers || {};
    await smartOnboarding.saveAnswers(req.user._id, agentId, answers);
    const state = await smartOnboarding.getState(req.user._id, agentId);
    return res.json({ success: true, data: state });
  } catch (err) {
    return next(err);
  }
};

exports.completeAgent = async (req, res, next) => {
  try {
    const { agentId } = req.params;
    const answers = req.body?.answers || {};
    if (Object.keys(answers).length) {
      await smartOnboarding.saveAnswers(req.user._id, agentId, answers);
    }
    await smartOnboarding.completeLayer(req.user._id, agentId);
    const state = await smartOnboarding.getState(req.user._id, agentId);
    return res.json({ success: true, data: state });
  } catch (err) {
    return next(err);
  }
};

exports.skipAgent = async (req, res, next) => {
  try {
    const { agentId } = req.params;
    const state = await smartOnboarding.skipLayer(req.user._id, agentId);
    return res.json({ success: true, data: state });
  } catch (err) {
    return next(err);
  }
};

exports.resetAgent = async (req, res, next) => {
  try {
    const { agentId } = req.params;
    if (!VALID_AGENTS.includes(agentId)) {
      return res.status(400).json({ success: false, message: 'סוכן לא נתמך' });
    }
    const state = await smartOnboarding.resetLayer(req.user._id, agentId);
    return res.json({ success: true, message: 'נתוני האונבורדינג נמחקו', data: state });
  } catch (err) {
    return next(err);
  }
};

exports.getAgentContext = async (req, res, next) => {
  try {
    const { agentId } = req.params;
    const context = await smartOnboarding.getContextForAgent(req.user._id, agentId);
    return res.json({ success: true, data: context });
  } catch (err) {
    return next(err);
  }
};

exports.getFullProfile = async (req, res, next) => {
  try {
    const profile = await UserProfile.findOrCreateForUser(req.user._id);
    const agents = {};
    for (const agentId of VALID_AGENTS) {
      agents[agentId] = await smartOnboarding.getState(req.user._id, agentId);
    }
    const general = await smartOnboarding.getState(req.user._id, 'general');
    return res.json({
      success: true,
      data: {
        general,
        agents,
        smartOnboarding: profile.smartOnboarding || null,
      },
    });
  } catch (err) {
    return next(err);
  }
};
