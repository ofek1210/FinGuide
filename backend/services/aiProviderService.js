/**
 * Modular AI Provider — Claude / OpenAI / Ollama
 *
 * Controlled by env vars:
 *   AI_PROVIDER=claude | openai | ollama  (default: ollama)
 *   ANTHROPIC_API_KEY=...
 *   OPENAI_API_KEY=...
 *   OPENAI_MODEL=gpt-4o          (default)
 *   ANTHROPIC_MODEL=claude-3-5-haiku-20241022  (default)
 *   OLLAMA_BASE_URL=http://localhost:11434
 *   OLLAMA_MODEL=llama3.1:8b
 */

const PROVIDER = (process.env.AI_PROVIDER || 'ollama').toLowerCase();
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o';
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-20241022';
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.1:8b';

function cleanText(text) {
  if (!text) return '';
  return text.replace(/^["'"]+|["'"]+$/g, '').trim();
}

async function callClaude(messages, options = {}) {
  if (!ANTHROPIC_API_KEY) return null;

  const systemMsg = messages.find(m => m.role === 'system');
  const chatMessages = messages.filter(m => m.role !== 'system');

  try {
    const body = {
      model: ANTHROPIC_MODEL,
      max_tokens: options.maxTokens || 600,
      temperature: options.temperature ?? 0.3,
      messages: chatMessages,
    };
    if (systemMsg) body.system = systemMsg.content;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(options.timeoutMs || 30000),
    });

    if (!res.ok) {
      console.error('[AI] Claude HTTP error:', res.status);
      return null;
    }
    const data = await res.json();
    return cleanText(data.content?.[0]?.text || '') || null;
  } catch (err) {
    console.error('[AI] Claude error:', err.message);
    return null;
  }
}

async function callOpenAI(messages, options = {}) {
  if (!OPENAI_API_KEY) return null;

  try {
    const body = {
      model: OPENAI_MODEL,
      messages,
      max_tokens: options.maxTokens || 600,
      temperature: options.temperature ?? 0.3,
    };

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(options.timeoutMs || 30000),
    });

    if (!res.ok) {
      console.error('[AI] OpenAI HTTP error:', res.status);
      return null;
    }
    const data = await res.json();
    return cleanText(data.choices?.[0]?.message?.content || '') || null;
  } catch (err) {
    console.error('[AI] OpenAI error:', err.message);
    return null;
  }
}

async function callOllama(messages, options = {}) {
  try {
    const body = {
      model: OLLAMA_MODEL,
      messages,
      stream: false,
      options: {
        temperature: options.temperature ?? 0.2,
        top_p: 0.9,
        num_predict: options.maxTokens || 400,
      },
    };

    const res = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(options.timeoutMs || 30000),
    });

    if (!res.ok) return null;
    const data = await res.json();
    return cleanText(data.message?.content || '') || null;
  } catch {
    return null;
  }
}

/**
 * Main entry: call the configured provider, fall back to Ollama.
 * @param {Array<{role: string, content: string}>} messages
 * @param {object} options
 * @returns {Promise<string|null>}
 */
async function callAI(messages, options = {}) {
  let result = null;

  if (PROVIDER === 'claude') {
    result = await callClaude(messages, options);
    if (!result) {
      console.warn('[AI] Claude unavailable — falling back to Ollama');
      result = await callOllama(messages, options);
    }
  } else if (PROVIDER === 'openai') {
    result = await callOpenAI(messages, options);
    if (!result) {
      console.warn('[AI] OpenAI unavailable — falling back to Ollama');
      result = await callOllama(messages, options);
    }
  } else {
    result = await callOllama(messages, options);
  }

  return result;
}

/**
 * Convenience: single-turn structured analysis call.
 * Returns the LLM text or null.
 */
async function analyzeWithAI(systemPrompt, userPrompt, options = {}) {
  return callAI(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    { maxTokens: options.maxTokens || 700, temperature: options.temperature ?? 0.3, ...options },
  );
}

module.exports = { callAI, analyzeWithAI, PROVIDER };
