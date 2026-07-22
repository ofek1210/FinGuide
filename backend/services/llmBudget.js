'use strict';

/**
 * Per-user Claude spend guard (Mongo-backed) with process-level fallback.
 *
 * Configure via env (set any to 0 to disable that specific limit):
 *   LLM_MAX_CALLS, LLM_TOKEN_BUDGET, LLM_WINDOW_MINUTES, LLM_MAX_OUTPUT_TOKENS
 */

const LlmUserBudget = require('../models/LlmUserBudget');

const num = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

const MAX_CALLS = num(process.env.LLM_MAX_CALLS, 40);
const TOKEN_BUDGET = num(process.env.LLM_TOKEN_BUDGET, 200000);
const WINDOW_MS = num(process.env.LLM_WINDOW_MINUTES, 60) * 60 * 1000;
const MAX_OUTPUT_TOKENS = num(process.env.LLM_MAX_OUTPUT_TOKENS, 1024);

/** Process-level fallback when no userId is provided (scripts / tips). */
let windowStart = Date.now();
let calls = 0;
let tokens = 0;
let warnedThisWindow = false;

function rollProcessIfNeeded() {
  if (WINDOW_MS > 0 && Date.now() - windowStart >= WINDOW_MS) {
    windowStart = Date.now();
    calls = 0;
    tokens = 0;
    warnedThisWindow = false;
  }
}

function isOverBudget(callCount, tokenCount) {
  const overCalls = MAX_CALLS > 0 && callCount >= MAX_CALLS;
  const overTokens = TOKEN_BUDGET > 0 && tokenCount >= TOKEN_BUDGET;
  return overCalls || overTokens;
}

function warnBudget(userKey, callCount, tokenCount) {
  console.warn(
    `[llmBudget] Claude budget reached for ${userKey} (${callCount} calls / ${tokenCount} tokens) — ` +
      'falling back to Ollama/rule-based until the window resets.',
  );
}

/**
 * @param {string|import('mongoose').Types.ObjectId|null|undefined} userId
 * @returns {Promise<boolean>}
 */
async function canSpend(userId) {
  if (!userId) {
    rollProcessIfNeeded();
    if (isOverBudget(calls, tokens)) {
      if (!warnedThisWindow) {
        warnedThisWindow = true;
        warnBudget('process', calls, tokens);
      }
      return false;
    }
    return true;
  }

  try {
    let doc = await LlmUserBudget.findOne({ user: userId });
    const now = Date.now();
    if (!doc) {
      return true;
    }
    if (WINDOW_MS > 0 && now - new Date(doc.windowStart).getTime() >= WINDOW_MS) {
      doc.windowStart = new Date();
      doc.calls = 0;
      doc.tokens = 0;
      await doc.save();
      return true;
    }
    if (isOverBudget(doc.calls, doc.tokens)) {
      warnBudget(String(userId), doc.calls, doc.tokens);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[llmBudget] canSpend fallback to process:', err.message);
    rollProcessIfNeeded();
    return !isOverBudget(calls, tokens);
  }
}

/**
 * @param {string|import('mongoose').Types.ObjectId|null|undefined} userId
 * @param {{ input_tokens?: number, output_tokens?: number }} usage
 */
async function record(userId, usage) {
  const addTokens = (usage?.input_tokens || 0) + (usage?.output_tokens || 0);

  if (!userId) {
    calls += 1;
    tokens += addTokens;
    return;
  }

  try {
    const now = new Date();
    let doc = await LlmUserBudget.findOne({ user: userId });
    if (!doc) {
      await LlmUserBudget.create({
        user: userId,
        windowStart: now,
        calls: 1,
        tokens: addTokens,
      });
      return;
    }
    if (WINDOW_MS > 0 && Date.now() - new Date(doc.windowStart).getTime() >= WINDOW_MS) {
      doc.windowStart = now;
      doc.calls = 1;
      doc.tokens = addTokens;
    } else {
      doc.calls += 1;
      doc.tokens += addTokens;
    }
    await doc.save();
  } catch (err) {
    console.warn('[llmBudget] record fallback to process:', err.message);
    calls += 1;
    tokens += addTokens;
  }
}

function cap(requested) {
  if (!MAX_OUTPUT_TOKENS || MAX_OUTPUT_TOKENS <= 0) return requested;
  return Math.min(requested, MAX_OUTPUT_TOKENS);
}

function snapshot(userId) {
  if (!userId) {
    rollProcessIfNeeded();
    return { userId: null, windowStart, calls, tokens, maxCalls: MAX_CALLS, tokenBudget: TOKEN_BUDGET };
  }
  return { userId: String(userId), maxCalls: MAX_CALLS, tokenBudget: TOKEN_BUDGET };
}

module.exports = { canSpend, record, cap, snapshot };
