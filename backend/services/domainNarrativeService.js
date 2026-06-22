'use strict';

const { analyzeWithAI } = require('./aiProviderService');

function buildInsightFallbackNarrative(insights) {
  return (insights || []).map(i => `• ${i.title}: ${i.recommendation}`).join('\n');
}

/**
 * Shared LLM narrative wrapper for domain insight services (pension, insurance).
 */
async function generateDomainNarrative({
  systemPrompt,
  contextLines,
  insights,
  userPromptSuffix = 'כתוב ניתוח אישי תמציתי.',
  maxTokens = 600,
  temperature = 0.35,
}) {
  const userPrompt = `${(contextLines || []).filter(Boolean).join('\n')}\n\n${userPromptSuffix}`;
  const result = await analyzeWithAI(systemPrompt, userPrompt, { maxTokens, temperature });
  return result || buildInsightFallbackNarrative(insights);
}

module.exports = { generateDomainNarrative, buildInsightFallbackNarrative };
