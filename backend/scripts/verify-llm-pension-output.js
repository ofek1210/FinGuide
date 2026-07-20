'use strict';

/**
 * Post-LLM verification for pension recommendations (no flow changes).
 * Run after Ollama/provider is available:
 *   node scripts/verify-llm-pension-output.js [userId]
 *
 * Exits 0 when all 5 criteria pass; exits 1 with details otherwise.
 */
require('dotenv').config();

const mongoose = require('mongoose');
const { buildPensionAnalysis } = require('../services/pensionAnalysisService');
const { buildLlmInputPayload, validateLlmOutput, stripJsonFence } = require('../services/financialAdvisory/llmInsightFormatter');
const { analyzeWithAI } = require('../services/aiProviderService');

const USER_ID = process.argv[2] || '69a738de80b8dac7ec75aba8';

async function probeProvider() {
  const url = process.env.OLLAMA_BASE_URL || process.env.OLLAMA_URL || 'http://localhost:11434';
  try {
    const res = await fetch(`${url}/api/tags`, { signal: AbortSignal.timeout(5000) });
    return { ok: res.ok, url };
  } catch (err) {
    return { ok: false, url, error: err.message };
  }
}

function assertLlmContract({ analysis, llmCapture, failures }) {
  const llm = analysis.llm || {};

  // 1. llm.used is true
  if (!llm.used) {
    failures.push(`llm.used is false (reason: ${llm.reason ?? 'unknown'})`);
  }

  // 2. fallbackUsed is false
  if (llm.fallbackUsed !== false) {
    failures.push(`llm.fallbackUsed is ${llm.fallbackUsed} (expected false)`);
  }

  const primary = analysis.primaryRecommendations || [];
  const central = analysis.centralRecommendations || [];
  const approvedIds = new Set(central.map(c => c.id));

  // 3. validated LLM output reaches primaryRecommendations
  if (!llmCapture.validated?.primaryRecommendations?.length) {
    failures.push('no validated LLM output (raw parse/validation failed)');
  } else {
    const validatedIds = new Set(llmCapture.validated.primaryRecommendations.map(r => r.insightId));
    for (const id of approvedIds) {
      if (!validatedIds.has(id)) {
        failures.push(`validated LLM output missing approved insightId: ${id}`);
      }
    }
    for (const rec of primary) {
      if (!rec.title || !rec.explanation) {
        failures.push(`primaryRecommendations missing title/explanation for ${rec.insightId}`);
      }
      const validated = llmCapture.validated.primaryRecommendations.find(r => r.insightId === rec.insightId);
      if (validated && rec.title === validated.title && rec.explanation === validated.explanation) {
        // OK — LLM text propagated (or identical by coincidence)
      } else if (validated) {
        // primary should reflect validated LLM fields when LLM succeeded
        if (rec.title !== validated.title) {
          failures.push(`primary title differs from validated LLM for ${rec.insightId}`);
        }
        if (rec.explanation !== validated.explanation) {
          failures.push(`primary explanation differs from validated LLM for ${rec.insightId}`);
        }
        if ((rec.whyItMatters || '') !== (validated.whyItMatters || '')) {
          failures.push(`primary whyItMatters differs from validated LLM for ${rec.insightId}`);
        }
        if ((rec.nextStep || '') !== (validated.nextStep || '')) {
          failures.push(`primary nextStep differs from validated LLM for ${rec.insightId}`);
        }
      }
    }
  }

  // 5. no add/remove/modify approved recs or financial values
  const primaryIds = new Set(primary.map(r => r.insightId));
  if (primaryIds.size !== approvedIds.size) {
    failures.push(`primary count ${primaryIds.size} !== central count ${approvedIds.size}`);
  }
  for (const id of primaryIds) {
    if (!approvedIds.has(id)) {
      failures.push(`primaryRecommendations contains unapproved insightId: ${id}`);
    }
  }
  for (const id of approvedIds) {
    if (!primaryIds.has(id)) {
      failures.push(`primaryRecommendations missing approved insightId: ${id}`);
    }
  }

  for (const rec of primary) {
    const src = central.find(c => c.id === rec.insightId);
    if (!src) continue;
    const srcAmt = src.financialImpact?.amount ?? null;
    const recAmt = rec.financialImpact?.amount ?? null;
    if (srcAmt !== recAmt) {
      failures.push(`financialImpact.amount changed for ${rec.insightId}: ${srcAmt} → ${recAmt}`);
    }
  }

  const llmRecCount = llmCapture.validated?.primaryRecommendations?.length ?? 0;
  if (llmRecCount > approvedIds.size) {
    failures.push(`LLM returned ${llmRecCount} recommendations but only ${approvedIds.size} were approved`);
  }
}

async function main() {
  const probe = await probeProvider();
  if (!probe.ok) {
    console.error('LLM provider not reachable — fix connection first.');
    console.error(`  URL: ${probe.url}`);
    if (probe.error) console.error(`  Error: ${probe.error}`);
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);

  const analysis = await buildPensionAnalysis(USER_ID, { skipLLM: false });
  const central = analysis.centralRecommendations || [];
  const payload = buildLlmInputPayload(central, {
    productType: 'PENSION',
    marketDataPeriod: analysis.marketData?.latestReportPeriod ?? null,
    language: 'he',
  });
  const raw = await analyzeWithAI(
    require('../services/financialAdvisory/llmInsightFormatter').LLM_SYSTEM_PROMPT,
    JSON.stringify(payload),
    { maxTokens: 700, temperature: 0.3, timeoutMs: 120000 },
  );
  let validated = null;
  if (raw) {
    try {
      validated = validateLlmOutput(JSON.parse(stripJsonFence(raw)), central.map(c => c.id));
    } catch {
      validated = null;
    }
  }
  const llmCapture = { payload, rawResponse: raw, validated };

  const failures = [];
  assertLlmContract({ analysis, llmCapture, failures });

  console.log('=== LLM pension verification ===');
  console.log('userId:', USER_ID);
  console.log('llm:', JSON.stringify(analysis.llm, null, 2));
  console.log('primaryRecommendations:', JSON.stringify(
    (analysis.primaryRecommendations || []).map(r => ({
      insightId: r.insightId,
      title: r.title,
      explanation: r.explanation,
      whyItMatters: r.whyItMatters,
      nextStep: r.nextStep,
      financialImpact: r.financialImpact,
    })),
    null,
    2,
  ));

  if (failures.length) {
    console.error('\nFAILED:');
    failures.forEach(f => console.error(`  - ${f}`));
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log('\nPASSED all 5 criteria.');
  await mongoose.disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
