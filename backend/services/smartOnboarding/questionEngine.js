'use strict';

const { GENERAL_QUESTIONS, AGENT_QUESTIONS, VALID_AGENTS } = require('../../config/smartOnboardingConfig');
const { buildKnownAnswersMap, isAnswered } = require('./contextResolver');
const { isLayerComplete, isLayerSkipped } = require('./answerStore');

async function getMissingQuestions(userId, profile, layer) {
  const questions = layer === 'general'
    ? GENERAL_QUESTIONS
    : (AGENT_QUESTIONS[layer] || []);

  if (!questions.length && layer !== 'general') return [];

  const known = await buildKnownAnswersMap(userId, profile, layer);
  return questions.filter(q => !known[q.id]).map(q => ({
    id: q.id,
    type: q.type,
    title: q.title,
    sub: q.sub || null,
    options: q.options || null,
    required: q.required !== false,
  }));
}

async function getGeneralOnboardingState(userId, profile) {
  const missing = await getMissingQuestions(userId, profile, 'general');
  const known = await buildKnownAnswersMap(userId, profile, 'general');
  const complete = isLayerComplete(profile, 'general') || missing.length === 0;

  return {
    layer: 'general',
    complete,
    completedAt: profile.smartOnboarding?.general?.completedAt || null,
    totalQuestions: GENERAL_QUESTIONS.length,
    answeredCount: Object.keys(known).length,
    missingQuestions: missing,
    knownAnswers: Object.fromEntries(
      Object.entries(known).map(([id, r]) => [id, { answer: r.value, source: r.source, confidence: r.confidence }]),
    ),
    estimatedMinutes: Math.max(1, Math.ceil(missing.length * 0.15)),
  };
}

async function getAgentOnboardingState(userId, profile, agentId) {
  if (!VALID_AGENTS.includes(agentId)) {
    return { layer: agentId, complete: true, missingQuestions: [], invalidAgent: true };
  }

  const missing = await getMissingQuestions(userId, profile, agentId);
  const known = await buildKnownAnswersMap(userId, profile, agentId);
  const markedComplete = isLayerComplete(profile, agentId);
  const skipped = isLayerSkipped(profile, agentId);
  const complete = markedComplete || missing.length === 0;
  const agentLayer = profile.smartOnboarding?.agents instanceof Map
    ? profile.smartOnboarding.agents.get(agentId)
    : profile.smartOnboarding?.agents?.[agentId];

  return {
    layer: agentId,
    complete,
    skipped,
    completedAt: agentLayer?.completedAt || null,
    skippedAt: agentLayer?.skippedAt || null,
    totalQuestions: AGENT_QUESTIONS[agentId].length,
    answeredCount: Object.keys(known).length,
    missingQuestions: missing,
    knownAnswers: Object.fromEntries(
      Object.entries(known).map(([id, r]) => [id, { answer: r.value, source: r.source, confidence: r.confidence }]),
    ),
    estimatedMinutes: Math.max(1, Math.ceil(missing.length * 0.2)),
    shouldShowModal: !complete && !skipped && missing.length > 0,
  };
}

async function buildAgentContext(userId, profile, agentId) {
  const generalKnown = await buildKnownAnswersMap(userId, profile, 'general');
  const agentKnown = VALID_AGENTS.includes(agentId)
    ? await buildKnownAnswersMap(userId, profile, agentId)
    : {};

  return {
    general: Object.fromEntries(Object.entries(generalKnown).map(([k, v]) => [k, v.value])),
    agent: Object.fromEntries(Object.entries(agentKnown).map(([k, v]) => [k, v.value])),
    meta: {
      generalComplete: isLayerComplete(profile, 'general'),
      agentComplete: isLayerComplete(profile, agentId),
    },
  };
}

module.exports = {
  getMissingQuestions,
  getGeneralOnboardingState,
  getAgentOnboardingState,
  buildAgentContext,
  isAnswered,
};
