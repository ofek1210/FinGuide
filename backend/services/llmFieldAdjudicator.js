/* eslint-disable no-restricted-syntax */

/**
 * LLM Adjudicator — asks Claude Haiku 4.5 to pick the correct value from a
 * list of heuristic candidates when reconciliation/scoring is inconclusive.
 *
 * Constrained-output design:
 *   The model can ONLY return an index into the candidate array (or null).
 *   It cannot invent a number. This eliminates hallucination of monetary
 *   values — every output is provably one of the values heuristics already
 *   considered.
 *
 * When to invoke (see `shouldAdjudicate`):
 *   - Best candidate confidence < 0.7
 *   - Reconciler emitted a violation for this field
 *   - Top two candidates within 0.05 score (a tie)
 *
 * When NOT to invoke:
 *   - Best candidate ≥ 0.9 with no violations (heuristics already confident)
 *   - No ANTHROPIC_API_KEY configured (graceful no-op)
 *   - Fewer than 2 candidates (nothing to choose between)
 *
 * Caching:
 *   In-memory Map keyed by sha256(field + candidate-values + snippet). Same
 *   input from two upload attempts costs one API call. Process-scoped only —
 *   upgrade to MongoDB once we see the access pattern stabilise in prod.
 *
 * @module llmFieldAdjudicator
 */

const crypto = require('crypto');
const llmBudget = require('./llmBudget');

let AnthropicCtor;
let cachedClient;
const responseCache = new Map();

const MODEL = 'claude-haiku-4-5';
const MAX_TOKENS = 256;
const SNIPPET_LINES_AROUND = 6;
const MAX_CANDIDATES_TO_SEND = 10;
const MAX_TEXT_SNIPPET_CHARS = 4000;

const ADJUDICATE_THRESHOLDS = Object.freeze({
  lowConfidence: 0.7,
  closeTieDelta: 0.05,
  skipIfConfidenceAbove: 0.9,
});

const FIELD_GUIDANCE = Object.freeze({
  period_month: {
    he: 'תקופת התלוש (חודש/שנה)',
    description:
      'The pay period of this payslip — month and year. Format must be MM/YYYY or YYYY-MM (e.g. "09/2022", "2026-01").',
  },
  gross_total: {
    he: 'סך תשלומים שוטף / ברוטו',
    description:
      'The total gross salary BEFORE any deductions. Usually labeled "סך תשלומים שוטף", "ברוטו שוטף", "סך תשלומים", or "שכר ברוטו". Excludes cumulative (year-to-date) values.',
  },
  net_payable: {
    he: 'סכום בבנק / לתשלום',
    description:
      'The FINAL amount transferred to the employee\'s bank account, after BOTH mandatory deductions (tax, insurance) AND voluntary deductions (e.g. pension contributions). Labeled "סכום בבנק" or "לתשלום". NOT necessarily "שכר נטו" — that label sometimes refers to gross minus mandatory only, before voluntary deductions.',
  },
  mandatory_total: {
    he: 'ניכויי חובה',
    description:
      'The total of MANDATORY (legally required) deductions: income tax + national insurance + health insurance. Usually labeled "ניכויי חובה" or "סה"כ ניכויים". This is NOT the gross_total and NOT a category code/identifier.',
  },
  income_tax: {
    he: 'מס הכנסה',
    description:
      'Israeli income tax (מס הכנסה) actually deducted from this paycheck. Can be 0 for employees below the tax threshold. NOT a configuration code like "קוד מס" and NOT a cumulative annual figure.',
  },
  national_insurance: {
    he: 'ביטוח לאומי',
    description:
      'Israeli national insurance employee contribution (ביטוח לאומי / ב.ל.). Typical rate is 0.4%–12% of gross. NOT the configuration code "קוד ב.לאומי 9" or similar reference numbers.',
  },
  health_insurance: {
    he: 'ביטוח בריאות / מס בריאות',
    description:
      'Israeli health tax employee contribution (ביטוח בריאות or מס בריאות). Typical rate is 3.1%–5% of gross.',
  },
});

function getAnthropicClient() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (cachedClient) return cachedClient;
  if (!AnthropicCtor) {
    // eslint-disable-next-line global-require
    AnthropicCtor = require('@anthropic-ai/sdk');
  }
  const ClientClass = AnthropicCtor.default || AnthropicCtor;
  cachedClient = new ClientClass();
  return cachedClient;
}

/**
 * Test-only — inject a stub client (used by jest.mock setups that can't easily
 * replace the lazy require above).
 */
function _setAnthropicClientForTests(client) {
  cachedClient = client;
}

function clearCache() {
  responseCache.clear();
}

function buildCacheKey({ field, candidates, snippet }) {
  const candidatePart = candidates
    .map(c => `${c.value}@${(c.score ?? 0).toFixed(3)}#${c.source ?? ''}`)
    .join('|');
  const snippetPart = (snippet || '').slice(0, 1024);
  return crypto.createHash('sha256').update(`${field}::${candidatePart}::${snippetPart}`).digest('hex');
}

/**
 * Pull a few lines around the most-relevant candidate's line index from the
 * raw text. Keeps the prompt focused on the section where the disagreement
 * is happening rather than dumping the entire payslip.
 */
function buildContextSnippet({ rawLines, candidates }) {
  if (!Array.isArray(rawLines) || rawLines.length === 0) return '';
  const indexes = new Set();
  for (const candidate of candidates) {
    if (typeof candidate.lineIndex !== 'number') continue;
    const start = Math.max(0, candidate.lineIndex - SNIPPET_LINES_AROUND);
    const end = Math.min(rawLines.length - 1, candidate.lineIndex + SNIPPET_LINES_AROUND);
    for (let i = start; i <= end; i += 1) indexes.add(i);
  }
  if (indexes.size === 0) {
    // Fall back to the first chunk if no candidates had line indices.
    return rawLines.slice(0, 30).map((line, i) => `L${i}: ${line}`).join('\n').slice(0, MAX_TEXT_SNIPPET_CHARS);
  }
  const sorted = [...indexes].sort((a, b) => a - b);
  const lines = sorted.map(i => `L${i}: ${rawLines[i]}`);
  return lines.join('\n').slice(0, MAX_TEXT_SNIPPET_CHARS);
}

function buildPrompt({ field, candidates, snippet, currentResolutions }) {
  const guidance = FIELD_GUIDANCE[field] || {
    he: field,
    description: `The "${field}" value extracted from a payslip.`,
  };

  const candidateList = candidates
    .slice(0, MAX_CANDIDATES_TO_SEND)
    .map((c, i) => `  [${i}] value=${c.value}  (source=${c.source || '?'}, line=${c.lineIndex ?? '?'}, score=${(c.score ?? 0).toFixed(2)})`)
    .join('\n');

  const resolvedContext = Object.entries(currentResolutions || {})
    .filter(([, v]) => Number.isFinite(v))
    .map(([k, v]) => `  - ${k} = ${v}`)
    .join('\n') || '  (none yet)';

  return `You are an Israeli payroll OCR field adjudicator. The heuristic extractor produced multiple candidate values for one field; pick the correct one.

FIELD: ${field} (${guidance.he})
${guidance.description}

ALREADY RESOLVED FIELDS (for cross-check):
${resolvedContext}

CANDIDATES (you must pick exactly one of these indexes, or null if none are correct):
${candidateList}

RAW TEXT CONTEXT (lines from the payslip near the candidates):
${snippet}

Rules:
- You MAY only return an index into the candidate list above. You CANNOT invent a different value.
- If none of the candidates is the correct value, return chosen_candidate_index = null.
- Hebrew payslips often contain configuration codes (e.g. "קוד ב.לאומי 9") that look numeric but are NOT amounts — never pick those.
- Cumulative/year-to-date columns (under headings like "נתונים מצטברים" or "שכ.ב.לאומי") are NOT the monthly value — never pick those.
- Be conservative: if confidence < 0.6, return chosen_candidate_index = null.`;
}

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    chosen_candidate_index: {
      type: ['integer', 'null'],
      description: 'Zero-based index into the candidate list, or null if no candidate is correct.',
    },
    confidence: {
      type: 'number',
      minimum: 0,
      maximum: 1,
      description: 'How confident you are in the chosen index (or in the null answer).',
    },
    reason: {
      type: 'string',
      description: 'One-sentence explanation of the choice or rejection.',
    },
  },
  required: ['chosen_candidate_index', 'confidence', 'reason'],
  additionalProperties: false,
};

/**
 * Decide whether the LLM should be invoked for a given field.
 */
function shouldAdjudicate({ candidates, bestCandidate, hasViolation }) {
  if (!Array.isArray(candidates) || candidates.length < 2) return false;
  if (!bestCandidate || !Number.isFinite(bestCandidate.score)) return false;

  if (bestCandidate.score >= ADJUDICATE_THRESHOLDS.skipIfConfidenceAbove && !hasViolation) {
    return false;
  }
  if (hasViolation) return true;
  if (bestCandidate.score < ADJUDICATE_THRESHOLDS.lowConfidence) return true;

  const sorted = [...candidates]
    .filter(c => Number.isFinite(c.score) && c.value !== bestCandidate.value)
    .sort((a, b) => b.score - a.score);
  const runnerUp = sorted[0];
  if (runnerUp && (bestCandidate.score - runnerUp.score) < ADJUDICATE_THRESHOLDS.closeTieDelta) {
    return true;
  }
  return false;
}

/**
 * Adjudicate a single field. Returns `null` on any failure path (missing API
 * key, network error, malformed model output) so the caller falls back to the
 * existing heuristic resolution. Never throws.
 *
 * @returns {Promise<{chosenIndex: number|null, confidence: number, reason: string, source: 'llm_haiku'|'cache'}|null>}
 */
async function adjudicateField({
  field,
  candidates,
  rawLines,
  currentResolutions = {},
}) {
  if (!field || !Array.isArray(candidates) || candidates.length === 0) return null;

  const client = getAnthropicClient();
  if (!client) return null;

  const snippet = buildContextSnippet({ rawLines, candidates });
  const cacheKey = buildCacheKey({ field, candidates, snippet });
  if (responseCache.has(cacheKey)) {
    return { ...responseCache.get(cacheKey), source: 'cache' };
  }

  // Budget check after the cache lookup — cached hits are free and must still return.
  if (!llmBudget.canSpend()) return null;

  const prompt = buildPrompt({ field, candidates, snippet, currentResolutions });

  let response;
  try {
    response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      output_config: {
        format: { type: 'json_schema', schema: RESPONSE_SCHEMA },
      },
      messages: [{ role: 'user', content: prompt }],
    });
    llmBudget.record(response.usage);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn(`[llmFieldAdjudicator] API call failed for ${field}: ${error.message}`);
    return null;
  }

  const textBlock = (response.content || []).find(b => b.type === 'text');
  if (!textBlock || !textBlock.text) return null;

  let parsed;
  try {
    parsed = JSON.parse(textBlock.text);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn(`[llmFieldAdjudicator] non-JSON response for ${field}: ${error.message}`);
    return null;
  }

  const chosenIndex = parsed.chosen_candidate_index;
  if (chosenIndex !== null && (!Number.isInteger(chosenIndex) || chosenIndex < 0 || chosenIndex >= candidates.length)) {
    return null;
  }
  const result = {
    chosenIndex,
    confidence: Number.isFinite(parsed.confidence) ? parsed.confidence : 0,
    reason: typeof parsed.reason === 'string' ? parsed.reason : '',
    source: 'llm_haiku',
  };
  responseCache.set(cacheKey, result);
  return result;
}

module.exports = {
  adjudicateField,
  shouldAdjudicate,
  clearCache,
  ADJUDICATE_THRESHOLDS,
  FIELD_GUIDANCE,
  // Test seams:
  _setAnthropicClientForTests,
  _internal: {
    buildCacheKey,
    buildContextSnippet,
    buildPrompt,
    RESPONSE_SCHEMA,
  },
};
