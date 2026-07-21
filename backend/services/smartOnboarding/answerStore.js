'use strict';

function getNested(obj, path) {
  if (!path || !obj) return undefined;
  return path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

function wrapAnswer(answer, source = 'user', confidence = 1) {
  return {
    answer,
    source,
    updatedAt: new Date(),
    confidence,
  };
}

function getAgentLayer(profile, layer) {
  const agents = profile.smartOnboarding?.agents;
  if (agents instanceof Map) return agents.get(layer);
  return agents?.[layer];
}

function readStoredAnswer(profile, layer, questionId) {
  if (layer === 'general') {
    return profile.smartOnboarding?.general?.answers?.[questionId] || null;
  }
  const agentLayer = getAgentLayer(profile, layer);
  return agentLayer?.answers?.[questionId] || null;
}

function writeStoredAnswer(profile, layer, questionId, answer, meta = {}) {
  if (!profile.smartOnboarding) profile.smartOnboarding = { general: { answers: {} }, agents: new Map() };
  const wrapped = wrapAnswer(answer, meta.source || 'user', meta.confidence ?? 1);

  if (layer === 'general') {
    profile.smartOnboarding.general = profile.smartOnboarding.general || { answers: {} };
    profile.smartOnboarding.general.answers = profile.smartOnboarding.general.answers || {};
    profile.smartOnboarding.general.answers[questionId] = wrapped;
    profile.markModified('smartOnboarding');
    return;
  }

  if (!(profile.smartOnboarding.agents instanceof Map)) {
    profile.smartOnboarding.agents = new Map(Object.entries(profile.smartOnboarding.agents || {}));
  }
  let agentLayer = profile.smartOnboarding.agents.get(layer);
  if (!agentLayer) {
    agentLayer = { answers: {} };
    profile.smartOnboarding.agents.set(layer, agentLayer);
  }
  agentLayer.answers = agentLayer.answers || {};
  agentLayer.answers[questionId] = wrapped;
  profile.smartOnboarding.agents.set(layer, agentLayer);
  profile.markModified('smartOnboarding');
}

function applyAnswerToProfile(profile, questionDef, answer) {
  if (!questionDef.profilePath) return;
  const [section, field] = questionDef.profilePath.split('.');
  if (section && field) {
    profile[section] = profile[section] || {};
    profile[section][field] = answer;
    profile.markModified(section);
  }

  if (questionDef.id === 'general.hasChildren') {
    profile.personal = profile.personal || {};
    profile.personal.childrenCount = answer === true || answer === 'yes' ? Math.max(profile.personal.childrenCount || 0, 1) : 0;
    profile.markModified('personal');
  }
  if (questionDef.id === 'payslip.onlyEmployer') {
    profile.employment = profile.employment || {};
    profile.employment.isPrimaryJob = answer === true || answer === 'yes';
    profile.employment.hasMultipleEmployers = !(answer === true || answer === 'yes');
    profile.markModified('employment');
  }
  if (questionDef.id === 'general.employmentStatus') {
    profile.employment = profile.employment || {};
    if (answer === 'employee') profile.employment.employmentType = 'employee';
    else if (answer === 'self_employed') profile.employment.employmentType = 'self_employed';
    else if (answer === 'both') profile.employment.employmentType = 'both';
    profile.employment.employmentStatus = answer;
    profile.markModified('employment');
  }
}

function markLayerComplete(profile, layer) {
  if (!profile.smartOnboarding) profile.smartOnboarding = { general: { answers: {} }, agents: new Map() };
  const now = new Date();
  if (layer === 'general') {
    profile.smartOnboarding.general = profile.smartOnboarding.general || { answers: {} };
    profile.smartOnboarding.general.completedAt = now;
  } else {
    if (!(profile.smartOnboarding.agents instanceof Map)) {
      profile.smartOnboarding.agents = new Map(Object.entries(profile.smartOnboarding.agents || {}));
    }
    const existing = profile.smartOnboarding.agents.get(layer) || { answers: {} };
    existing.completedAt = now;
    profile.smartOnboarding.agents.set(layer, existing);
  }
  profile.markModified('smartOnboarding');
}

function isLayerComplete(profile, layer) {
  if (layer === 'general') {
    return Boolean(profile.smartOnboarding?.general?.completedAt);
  }
  const agents = profile.smartOnboarding?.agents;
  if (agents instanceof Map) return Boolean(agents.get(layer)?.completedAt);
  return Boolean(agents?.[layer]?.completedAt);
}

function isLayerSkipped(profile, layer) {
  if (layer === 'general') return false;
  const agents = profile.smartOnboarding?.agents;
  if (agents instanceof Map) return Boolean(agents.get(layer)?.skippedAt);
  return Boolean(agents?.[layer]?.skippedAt);
}

function markLayerSkipped(profile, layer) {
  if (layer === 'general') return;
  if (!profile.smartOnboarding) profile.smartOnboarding = { general: { answers: {} }, agents: new Map() };
  if (!(profile.smartOnboarding.agents instanceof Map)) {
    profile.smartOnboarding.agents = new Map(Object.entries(profile.smartOnboarding.agents || {}));
  }
  const existing = profile.smartOnboarding.agents.get(layer) || { answers: {} };
  existing.skippedAt = new Date();
  profile.smartOnboarding.agents.set(layer, existing);
  profile.markModified('smartOnboarding');
}

function exportAnswersForAgent(profile, agentId) {
  const general = profile.smartOnboarding?.general?.answers || {};
  const agentLayer = getAgentLayer(profile, agentId);
  const agent = agentLayer?.answers || {};
  return { general, agent, combined: { ...general, ...agent } };
}

module.exports = {
  getNested,
  wrapAnswer,
  readStoredAnswer,
  writeStoredAnswer,
  applyAnswerToProfile,
  markLayerComplete,
  markLayerSkipped,
  isLayerComplete,
  isLayerSkipped,
  exportAnswersForAgent,
};
