'use strict';

const { analyzeWithAI, PROVIDER } = require('../aiProviderService');
const config = require('../../config/financialAdvisoryConfig');

const LLM_SYSTEM_PROMPT = `You are a financial information explanation assistant.

Your role is to rewrite approved central recommendations into concise, clear, accessible Hebrew.

You do not decide which recommendations should exist.
You do not add recommendations.
You do not change any numbers.
You do not change severity, confidence, dates, sources, or financial impact.
You do not include raw percentile data, internal group keys, assumptions, disclaimers, or benchmark details in the main text.

For each supplied recommendation, return:
1. A short title (max 8 words)
2. A simple explanation (max 2 short sentences)
3. Why it matters (one sentence)
4. One practical next step

Use friendly and professional Hebrew.
Avoid legal and technical jargon.
Use no more than 45 words per recommendation total.

Return valid JSON only:
{
  "summary": "string",
  "recommendations": [
    {
      "insightId": "string",
      "title": "string",
      "explanation": "string",
      "whyItMatters": "string",
      "nextStep": "string"
    }
  ]
}`;

function stripJsonFence(text) {
  if (!text) return null;
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (fenced ? fenced[1] : trimmed).trim();
}

function validateLlmOutput(parsed, allowedIds) {
  if (!parsed || typeof parsed !== 'object') return null;

  const recs = parsed.recommendations || parsed.primaryRecommendations;
  if (!Array.isArray(recs)) return null;

  const allowed = new Set(allowedIds);
  const valid = recs.filter(r =>
    r && typeof r.insightId === 'string' && allowed.has(r.insightId)
    && typeof r.title === 'string'
    && typeof r.explanation === 'string');

  if (!valid.length && recs.length) return null;

  return {
    summary: typeof parsed.summary === 'string' ? parsed.summary : '',
    primaryRecommendations: valid.map(r => ({
      insightId: r.insightId,
      title: r.title,
      explanation: r.explanation,
      whyItMatters: r.whyItMatters || '',
      nextStep: r.nextStep || '',
    })),
  };
}

function formatInsightsDeterministically(insights) {
  const primaryRecommendations = (insights || []).map(ins => ({
    insightId: ins.id,
    title: ins.title,
    explanation: ins.reason,
    whyItMatters: ins.evidence?.limitations?.length
      ? `חשוב לשים לב: ${ins.evidence.limitations[0]}`
      : 'הנושא משפיע על התנאים והביצועים שלך לאורך זמן.',
    nextStep: ins.suggestedAction || 'כדאי לבדוק את הנתונים מול הגוף המנהל.',
    financialImpact: ins.financialImpact ?? null,
    evidence: ins.evidence ?? null,
  }));

  const count = primaryRecommendations.length;
  return {
    summary: count
      ? `מצאנו ${count} נושאים מרכזיים שכדאי לבדוק.`
      : 'לא נמצאו נושאים דורשים טיפול מיידי.',
    primaryRecommendations,
  };
}

function buildLlmInputPayload(centralRecommendations, { productType, marketDataPeriod, language }) {
  return {
    productType,
    language,
    marketDataPeriod,
    recommendations: (centralRecommendations || []).map(ins => ({
      insightId: ins.id,
      title: ins.title,
      reason: ins.reason,
      suggestedAction: ins.suggestedAction,
      financialImpact: ins.financialImpact ? {
        annual: ins.financialImpact.period === 'annual' ? ins.financialImpact.amount : null,
        untilRetirement: ins.financialImpact.period === 'retirement' ? ins.financialImpact.amount : null,
      } : null,
    })),
  };
}

function logLlmDevMeta({ llm, inputCount, outputCount, skipLLM, reason }) {
  if (process.env.NODE_ENV === 'production') return;
  console.log('[llmInsightFormatter]', {
    llmUsed: llm?.used ?? false,
    provider: llm?.provider ?? null,
    fallbackUsed: llm?.fallbackUsed ?? false,
    inputInsightCount: inputCount,
    outputRecommendationCount: outputCount,
    skipLLM: Boolean(skipLLM),
    ...(reason && !llm?.used ? { reason } : {}),
  });
}

async function formatFinancialInsightsWithLLM({
  productType,
  structuredInsights,
  marketDataPeriod,
  language = 'he',
  skipLLM = false,
}) {
  const central = structuredInsights || [];
  const insightIds = central.map(i => i.id);
  const payload = buildLlmInputPayload(central, { productType, marketDataPeriod, language });

  if (skipLLM || !central.length) {
    const formatted = formatInsightsDeterministically(central);
    const llm = { used: false, provider: null, fallbackUsed: true, reason: skipLLM ? 'skipLLM' : 'empty_input' };
    logLlmDevMeta({ llm, inputCount: central.length, outputCount: formatted.primaryRecommendations.length, skipLLM });
    return { formatted, llm };
  }

  let raw = null;
  let providerUsed = PROVIDER;
  let failReason = null;
  try {
    raw = await analyzeWithAI(
      LLM_SYSTEM_PROMPT,
      JSON.stringify(payload),
      { timeoutMs: config.llm.timeoutMs, maxTokens: config.llm.maxTokens, temperature: config.llm.temperature },
    );
  } catch (err) {
    failReason = err.message?.includes('timeout') ? 'timeout' : 'provider_unavailable';
    console.warn('[llmInsightFormatter] LLM call failed:', err.message);
    raw = null;
  }

  if (!raw) {
    const formatted = formatInsightsDeterministically(central);
    const reason = failReason
      || (providerUsed === 'ollama' ? 'provider_unavailable' : 'missing_api_key');
    const llm = { used: false, provider: providerUsed, fallbackUsed: true, reason };
    logLlmDevMeta({ llm, inputCount: central.length, outputCount: formatted.primaryRecommendations.length, skipLLM });
    return { formatted, llm };
  }

  let parsed;
  try {
    parsed = JSON.parse(stripJsonFence(raw));
  } catch {
    parsed = null;
    failReason = 'invalid_response';
  }

  const validated = validateLlmOutput(parsed, insightIds);
  if (!validated) {
    const formatted = formatInsightsDeterministically(central);
    const llm = { used: true, provider: providerUsed, fallbackUsed: true, reason: failReason || 'invalid_response' };
    logLlmDevMeta({ llm, inputCount: central.length, outputCount: formatted.primaryRecommendations.length, skipLLM });
    return { formatted, llm };
  }

  const llm = { used: true, provider: providerUsed, fallbackUsed: false };
  logLlmDevMeta({ llm, inputCount: central.length, outputCount: validated.primaryRecommendations.length, skipLLM });
  return { formatted: validated, llm };
}

module.exports = {
  formatFinancialInsightsWithLLM,
  formatInsightsDeterministically,
  validateLlmOutput,
  buildLlmInputPayload,
  stripJsonFence,
  LLM_SYSTEM_PROMPT,
};
