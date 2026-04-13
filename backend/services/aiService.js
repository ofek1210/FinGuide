const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.2:1b";

async function requestOllama(path, options = {}, timeoutMs = 30000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(`${OLLAMA_URL}${path}`, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function buildPrompt(userMessage) {
  return `
You are a senior financial assistant inside a fintech app.

Hard rules (MUST follow):
- Reply ONLY in Hebrew.
- Answer the user's question directly. Do NOT translate words. Do NOT explain meanings of words.
- Do NOT invent personal numbers or claim you saw a payslip unless provided.
- If the question is general (e.g., pension contributions), give general guidance.
- Keep it short: 1-2 sentences max.
- Output ONLY the final answer text (no lists, no quotes, no headings).

User question:
${userMessage}
`.trim();
}

function cleanAnswer(text) {
  if (!text) return "";
  return text.replace(/^["'“]+|["'”]+$/g, "").trim();
}

async function generateAnswer(message) {
  try {
    const payload = {
      model: OLLAMA_MODEL,
      prompt: buildPrompt(message),
      stream: false,
      options: {
        temperature: 0.2,
        top_p: 0.9,
        num_predict: 180,
      },
    };

    const resp = await requestOllama("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      const err = new Error(`Ollama error: HTTP ${resp.status}`);
      err.details = text;
      err.statusCode = 500;
      throw err;
    }

    const data = await resp.json();
    const answer = cleanAnswer((data.response || "").trim());

    return {
      answer,
      source: data.model || OLLAMA_MODEL,
    };
  } catch (err) {
    if (err.name === "AbortError") {
      const e = new Error("Ollama request timed out");
      e.statusCode = 500;
      throw e;
    }
    throw err;
  }
}

async function checkAIAvailability() {
  try {
    const response = await requestOllama("/api/tags", {}, 5000);
    if (!response.ok) {
      return {
        available: false,
        source: OLLAMA_MODEL,
        reason: `http_${response.status}`,
      };
    }

    return {
      available: true,
      source: OLLAMA_MODEL,
    };
  } catch (error) {
    return {
      available: false,
      source: OLLAMA_MODEL,
      reason: error?.name === "AbortError" ? "timeout" : "connection_failed",
    };
  }
}

module.exports = {
  checkAIAvailability,
  generateAnswer,
};
