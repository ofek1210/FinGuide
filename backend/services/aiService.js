const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.2:1b";

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
  // Timeout so it won't hang forever
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

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

    const resp = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
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
      model: data.model || OLLAMA_MODEL,
    };
  } catch (err) {
    if (err.name === "AbortError") {
      const e = new Error("Ollama request timed out");
      e.statusCode = 500;
      throw e;
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  generateAnswer,
};
