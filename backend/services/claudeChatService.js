const Anthropic = require('@anthropic-ai/sdk');
const { askLLM: askOllama } = require('./aiService');

const CHAT_PROVIDER = (process.env.CHAT_PROVIDER || 'claude').toLowerCase();
const CHAT_MODEL = process.env.CHAT_MODEL || 'claude-sonnet-4-20250514';

let anthropicClient = null;

function getAnthropicClient() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropicClient;
}

function buildEnhancedSystemPrompt(userContext, profile, insights, recommendations) {
  const lines = [
    'אתה יועץ פיננסי של FinGuide — עוזר לעובדים בישראל להבין תלושי שכר, פנסיה וביטוחים.',
    'ענה בעברית קצרה וברורה. אל תמציא נתונים. אם חסר מידע — אמור זאת.',
  ];

  if (profile) {
    const p = profile.personal || {};
    const a = profile.assets || {};
    lines.push('', 'פרופיל משתמש:');
    if (p.age) lines.push(`גיל: ${p.age}`);
    if (p.maritalStatus) lines.push(`מצב משפחתי: ${p.maritalStatus}`);
    if (p.childrenCount != null) lines.push(`ילדים: ${p.childrenCount}`);
    if (a.hasMortgage) lines.push('יש משכנתא');
    if (a.ownsApartment) lines.push('בבעלות דירה');
    if (a.ownsCar) lines.push('בבעלות רכב');
  }

  if (userContext?.grossSalary != null) {
    lines.push('', 'תלוש אחרון:');
    lines.push(`ברוטו: ${userContext.grossSalary} ₪`);
    if (userContext.netSalary != null) lines.push(`נטו: ${userContext.netSalary} ₪`);
    if (userContext.pensionEmployee != null) lines.push(`פנסיה עובד: ${userContext.pensionEmployee} ₪`);
    if (userContext.tax != null) lines.push(`מס הכנסה: ${userContext.tax} ₪`);
  }

  if (insights?.length) {
    lines.push('', 'תובנות פעילות:');
    insights.slice(0, 3).forEach(i => lines.push(`- ${i.title}: ${i.description}`));
  }

  if (recommendations?.length) {
    lines.push('', 'המלצות ביטוח פעילות:');
    recommendations.slice(0, 3).forEach(r => lines.push(`- ${r.title} (${r.importance})`));
  }

  return lines.join('\n');
}

async function askClaude(userMessage, systemPrompt, history = []) {
  const client = getAnthropicClient();
  if (!client) return null;

  const historyMessages = (history || [])
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .slice(-10)
    .map(m => ({ role: m.role, content: String(m.content || '').slice(0, 2000) }));

  try {
    const response = await client.messages.create({
      model: CHAT_MODEL,
      max_tokens: 400,
      temperature: 0.2,
      system: systemPrompt,
      messages: [...historyMessages, { role: 'user', content: userMessage }],
    });

    const text = response.content
      ?.filter(block => block.type === 'text')
      .map(block => block.text)
      .join('')
      .trim();

    return {
      answer: text || null,
      model: CHAT_MODEL,
      tokensUsed: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0),
    };
  } catch {
    return null;
  }
}

async function chat(userMessage, { userContext, profile, insights, recommendations, history }) {
  const systemPrompt = buildEnhancedSystemPrompt(userContext, profile, insights, recommendations);
  const provider = CHAT_PROVIDER === 'ollama' ? 'ollama' : 'claude';

  if (provider === 'claude') {
    const result = await askClaude(userMessage, systemPrompt, history);
    if (result?.answer) {
      return { answer: result.answer, source: 'claude', model: result.model, tokensUsed: result.tokensUsed };
    }
  }

  const ollamaAnswer = await askOllama(userMessage, userContext, history);
  return { answer: ollamaAnswer, source: 'ollama', model: process.env.OLLAMA_MODEL || 'llama3.1:8b', tokensUsed: null };
}

/**
 * Streaming version — calls Claude's streaming API and invokes callbacks for
 * each text token and when the stream is done.
 * Falls back to non-streaming if Claude is unavailable.
 *
 * @param {string} userMessage
 * @param {{ userContext, profile, insights, recommendations, history }} opts
 * @param {(token: string) => void} onToken  - called for every text chunk
 * @param {(full: string, tokensUsed: number|null) => void} onDone - called once at end
 */
async function streamChat(userMessage, { userContext, profile, insights, recommendations, history }, onToken, onDone) {
  const systemPrompt = buildEnhancedSystemPrompt(userContext, profile, insights, recommendations);
  const client = getAnthropicClient();

  if (!client || CHAT_PROVIDER === 'ollama') {
    // Fallback: get full answer then deliver in one shot
    const result = await chat(userMessage, { userContext, profile, insights, recommendations, history });
    onToken(result.answer || '');
    onDone(result.answer || '', null);
    return;
  }

  const historyMessages = (history || [])
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .slice(-10)
    .map(m => ({ role: m.role, content: String(m.content || '').slice(0, 2000) }));

  let fullText = '';
  try {
    const stream = await client.messages.stream({
      model: CHAT_MODEL,
      max_tokens: 400,
      temperature: 0.2,
      system: systemPrompt,
      messages: [...historyMessages, { role: 'user', content: userMessage }],
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
        const token = event.delta.text || '';
        fullText += token;
        onToken(token);
      }
    }

    const finalMessage = await stream.finalMessage();
    const tokensUsed = finalMessage?.usage
      ? (finalMessage.usage.input_tokens || 0) + (finalMessage.usage.output_tokens || 0)
      : null;

    onDone(fullText, tokensUsed);
  } catch {
    // If streaming fails mid-way, deliver what we have or fallback
    if (fullText) {
      onDone(fullText, null);
    } else {
      const result = await chat(userMessage, { userContext, profile, insights, recommendations, history });
      onToken(result.answer || '');
      onDone(result.answer || '', null);
    }
  }
}

module.exports = { chat, streamChat, buildEnhancedSystemPrompt, askClaude };
