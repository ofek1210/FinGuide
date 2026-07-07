'use strict';

/**
 * Process-level spend guard for Anthropic (Claude) calls.
 *
 * Prevents runaway or repeated calls from draining API credits during testing.
 * Every Claude call site checks `canSpend()` first and `record(usage)` after,
 * and caps its `max_tokens` with `cap()`. When a limit is hit the call is
 * skipped (the caller falls back to Ollama or a rule-based response), so the
 * app keeps working — it just stops spending.
 *
 * Configure via env (set any to 0 to disable that specific limit):
 *   LLM_MAX_CALLS         — max Claude calls per rolling window   (default 40)
 *   LLM_TOKEN_BUDGET      — max input+output tokens per window    (default 200000)
 *   LLM_WINDOW_MINUTES    — rolling window length in minutes      (default 60)
 *   LLM_MAX_OUTPUT_TOKENS — hard ceiling on max_tokens per call   (default 1024)
 *
 * Defaults bound spend to roughly ≤ $1 per hour on Claude Haiku 4.5
 * ($1/1M input, $5/1M output) — a hard "won't drain in minutes" backstop.
 */

const num = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

const MAX_CALLS = num(process.env.LLM_MAX_CALLS, 40);
const TOKEN_BUDGET = num(process.env.LLM_TOKEN_BUDGET, 200000);
const WINDOW_MS = num(process.env.LLM_WINDOW_MINUTES, 60) * 60 * 1000;
const MAX_OUTPUT_TOKENS = num(process.env.LLM_MAX_OUTPUT_TOKENS, 1024);

let windowStart = Date.now();
let calls = 0;
let tokens = 0;
let warnedThisWindow = false;

function rollIfNeeded() {
  if (WINDOW_MS > 0 && Date.now() - windowStart >= WINDOW_MS) {
    windowStart = Date.now();
    calls = 0;
    tokens = 0;
    warnedThisWindow = false;
  }
}

/**
 * @returns {boolean} whether another Claude call is within budget.
 */
function canSpend() {
  rollIfNeeded();
  const overCalls = MAX_CALLS > 0 && calls >= MAX_CALLS;
  const overTokens = TOKEN_BUDGET > 0 && tokens >= TOKEN_BUDGET;
  if (overCalls || overTokens) {
    if (!warnedThisWindow) {
      warnedThisWindow = true;
      console.warn(
        `[llmBudget] Claude budget reached (${calls} calls / ${tokens} tokens this window) — ` +
        'falling back to Ollama/rule-based until the window resets. ' +
        'Raise LLM_MAX_CALLS / LLM_TOKEN_BUDGET in backend/.env to allow more.',
      );
    }
    return false;
  }
  return true;
}

/**
 * Record the token usage of a completed Claude call.
 * @param {{ input_tokens?: number, output_tokens?: number }} usage
 */
function record(usage) {
  calls += 1;
  tokens += (usage?.input_tokens || 0) + (usage?.output_tokens || 0);
}

/**
 * Clamp a requested max_tokens to the configured per-call ceiling.
 * @param {number} requested
 * @returns {number}
 */
function cap(requested) {
  if (MAX_OUTPUT_TOKENS > 0) {
    return Math.min(requested || MAX_OUTPUT_TOKENS, MAX_OUTPUT_TOKENS);
  }
  return requested;
}

/**
 * Current usage snapshot (for logging / a debug endpoint).
 */
function snapshot() {
  rollIfNeeded();
  return {
    calls,
    tokens,
    limits: {
      maxCalls: MAX_CALLS,
      tokenBudget: TOKEN_BUDGET,
      windowMinutes: WINDOW_MS / 60000,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
    },
  };
}

module.exports = { canSpend, record, cap, snapshot };
