'use strict';

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { buildPensionAnalysis } = require('../services/pensionAnalysisService');
const { analyzeWithAI, PROVIDER } = require('../services/aiProviderService');
const { LLM_SYSTEM_PROMPT, buildLlmInputPayload, validateLlmOutput, stripJsonFence } = require('../services/financialAdvisory/llmInsightFormatter');

const USER_ID = process.argv[2] || '69a738de80b8dac7ec75aba8';
const OUT = path.join(__dirname, 'live-verify-output');

async function probeOllama() {
  const url = process.env.OLLAMA_BASE_URL || process.env.OLLAMA_URL || 'http://localhost:11434';
  try {
    const res = await fetch(`${url}/api/tags`, { signal: AbortSignal.timeout(5000) });
    return { reachable: res.ok, status: res.status, url };
  } catch (err) {
    return { reachable: false, error: err.message, url };
  }
}

async function captureRawLlm(centralRecommendations) {
  const payload = buildLlmInputPayload(centralRecommendations, {
    productType: 'PENSION',
    marketDataPeriod: null,
    language: 'he',
  });
  const raw = await analyzeWithAI(LLM_SYSTEM_PROMPT, JSON.stringify(payload), {
    maxTokens: 700,
    temperature: 0.3,
    timeoutMs: 60000,
  });
  let parsed = null;
  let validated = null;
  if (raw) {
    try {
      parsed = JSON.parse(stripJsonFence(raw));
      validated = validateLlmOutput(parsed, centralRecommendations.map(c => c.id));
    } catch {
      parsed = { parseError: true, rawSnippet: raw.slice(0, 500) };
    }
  }
  return { payload, rawResponse: raw, parsed, validated };
}

function pickAdvisoryFields(data) {
  return {
    prioritizationStats: data.prioritizationStats,
    llm: data.llm,
    llmSummary: data.llmSummary,
    primaryRecommendations: data.primaryRecommendations,
    positiveFindings: data.positiveFindings,
    additionalInsights: data.additionalInsights,
    hiddenTechnicalInsights: data.hiddenTechnicalInsights,
    centralRecommendations: data.centralRecommendations,
    recommendations: data.recommendations,
    structuredInsights: data.structuredInsights,
  };
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  fs.mkdirSync(OUT, { recursive: true });

  const ollamaProbe = await probeOllama();

  const skipTrue = await buildPensionAnalysis(USER_ID, { skipLLM: true });
  const skipFalse = await buildPensionAnalysis(USER_ID, { skipLLM: false });

  const llmCapture = skipFalse.centralRecommendations?.length
    ? await captureRawLlm(skipFalse.centralRecommendations)
    : null;

  const apiResponse = { success: true, data: skipFalse };

  const out = {
    userId: USER_ID,
    ollamaProbe,
    provider: PROVIDER,
    verification: {
      rawCount: skipFalse.prioritizationStats?.rawCount,
      centralCount: skipFalse.prioritizationStats?.centralCount,
      positiveCount: skipFalse.prioritizationStats?.positiveCount,
      additionalCount: skipFalse.prioritizationStats?.additionalCount,
      hiddenCount: skipFalse.prioritizationStats?.hiddenCount,
      mergedOrHiddenCount: skipFalse.prioritizationStats?.mergedOrHidden,
      legacyRecommendationsEmpty: (skipFalse.recommendations?.length ?? 0) === 0,
      structuredInsightsUndefined: skipFalse.structuredInsights === undefined,
      llmSkipTrue: skipTrue.llm,
      llmSkipFalse: skipFalse.llm,
      llmCapture,
      advisory: pickAdvisoryFields(skipFalse),
    },
    apiResponse,
  };

  const file = path.join(OUT, `live-api-${USER_ID}.json`);
  fs.writeFileSync(file, JSON.stringify(out, null, 2), 'utf8');
  console.log(JSON.stringify(out.verification, null, 2));
  console.log(`\nWrote ${file}`);
  await mongoose.disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
