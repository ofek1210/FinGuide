'use strict';

const User = require('../../models/User');
const UserProfile = require('../../models/UserProfile');
const { ValidationError } = require('../../utils/appErrors');
const { GENERAL_QUESTIONS, AGENT_QUESTIONS, VALID_AGENTS } = require('../../config/smartOnboardingConfig');
const {
  writeStoredAnswer,
  applyAnswerToProfile,
  markLayerComplete,
  markLayerSkipped,
  resetAgentLayer,
} = require('./answerStore');
const {
  getGeneralOnboardingState,
  getAgentOnboardingState,
  buildAgentContext,
  getMissingQuestions,
} = require('./questionEngine');

function findQuestionDef(layer, questionId) {
  if (layer === 'general') {
    return GENERAL_QUESTIONS.find(q => q.id === questionId);
  }
  return (AGENT_QUESTIONS[layer] || []).find(q => q.id === questionId);
}

function validateAnswer(questionDef, answer) {
  if (answer == null || (typeof answer === 'string' && !answer.trim())) {
    throw new ValidationError(`תשובה חסרה לשאלה: ${questionDef.title}`);
  }
  if (questionDef.type === 'yesno') {
    const ok = answer === true || answer === false || answer === 'yes' || answer === 'no';
    if (!ok) throw new ValidationError('יש לבחור כן או לא');
  }
  if (questionDef.type === 'single' && questionDef.options) {
    const allowed = questionDef.options.map(o => o.value);
    if (!allowed.includes(answer)) throw new ValidationError('ערך לא חוקי');
  }
  if (questionDef.type === 'multi') {
    if (!Array.isArray(answer) || !answer.length) throw new ValidationError('יש לבחור לפחות אפשרות אחת');
  }
  if (questionDef.type === 'number') {
    const n = Number(answer);
    if (!Number.isFinite(n)) throw new ValidationError('יש להזין מספר');
  }
}

async function saveAnswers(userId, layer, answersPayload = {}) {
  const profile = await UserProfile.findOrCreateForUser(userId);
  const entries = Object.entries(answersPayload);

  for (const [questionId, answer] of entries) {
    const questionDef = findQuestionDef(layer, questionId);
    if (!questionDef) continue;
    validateAnswer(questionDef, answer);
    writeStoredAnswer(profile, layer, questionId, answer, { source: 'user', confidence: 1 });
    applyAnswerToProfile(profile, questionDef, answer);
  }

  await profile.save();
  return profile;
}

async function completeLayer(userId, layer) {
  const profile = await UserProfile.findOrCreateForUser(userId);
  const missing = await getMissingQuestions(userId, profile, layer);
  const requiredMissing = missing.filter(q => q.required !== false);
  if (requiredMissing.length) {
    throw new ValidationError('יש להשלים את כל השאלות לפני סיום', requiredMissing.map(q => ({
      field: q.id,
      message: q.title,
    })));
  }

  markLayerComplete(profile, layer);
  profile.completedAt = profile.completedAt || new Date();

  if (layer === 'general') {
    profile.employment = profile.employment || {};
    if (profile.employment.salaryType == null) profile.employment.salaryType = 'global';
    if (profile.employment.jobPercentage == null) profile.employment.jobPercentage = 100;
    if (profile.employment.isPrimaryJob == null) profile.employment.isPrimaryJob = true;
    if (profile.employment.hasMultipleEmployers == null) profile.employment.hasMultipleEmployers = false;
    profile.markModified('employment');
  }

  await profile.save();

  if (layer === 'general') {
    const user = await User.findById(userId);
    if (user) {
      user.onboarding = user.onboarding || {};
      user.onboarding.completed = true;
      user.onboarding.completedAt = new Date();
      user.onboarding.updatedAt = new Date();
      user.onboarding.data = profile.toLegacyOnboardingData();
      await user.save();
    }
  }

  return profile;
}

async function getState(userId, layer = 'general') {
  const profile = await UserProfile.findOrCreateForUser(userId);
  if (layer === 'general') return getGeneralOnboardingState(userId, profile);
  return getAgentOnboardingState(userId, profile, layer);
}

async function submitBatch(userId, layer, answersPayload) {
  await saveAnswers(userId, layer, answersPayload);
  const profile = await completeLayer(userId, layer);
  const state = layer === 'general'
    ? await getGeneralOnboardingState(userId, profile)
    : await getAgentOnboardingState(userId, profile, layer);
  return state;
}

async function getContextForAgent(userId, agentId) {
  if (!VALID_AGENTS.includes(agentId)) {
    throw new ValidationError('סוכן לא נתמך');
  }
  const profile = await UserProfile.findOrCreateForUser(userId);
  return buildAgentContext(userId, profile, agentId);
}

async function skipLayer(userId, layer) {
  if (layer === 'general') {
    throw new ValidationError('לא ניתן לדלג על האונבורדינג הכללי');
  }
  if (!VALID_AGENTS.includes(layer)) {
    throw new ValidationError('סוכן לא נתמך');
  }
  const profile = await UserProfile.findOrCreateForUser(userId);
  markLayerSkipped(profile, layer);
  await profile.save();
  return getAgentOnboardingState(userId, profile, layer);
}

async function resetLayer(userId, layer) {
  if (!VALID_AGENTS.includes(layer)) {
    throw new ValidationError('סוכן לא נתמך');
  }
  const profile = await UserProfile.findOrCreateForUser(userId);
  resetAgentLayer(profile, layer);
  await profile.save();
  return layer === 'general'
    ? getGeneralOnboardingState(userId, profile)
    : getAgentOnboardingState(userId, profile, layer);
}

module.exports = {
  getState,
  saveAnswers,
  completeLayer,
  submitBatch,
  skipLayer,
  resetLayer,
  getContextForAgent,
  findQuestionDef,
};
