/**
 * Base Agent — abstract class for all FinGuide AI agents.
 *
 * Every agent has:
 * - A name and description
 * - A system prompt
 * - Access to RAG retrieval
 * - A run() method that takes a query + context and returns an answer
 * - Metadata about which agent handled the query (for UI transparency)
 */

const Anthropic = require('@anthropic-ai/sdk');
const { retrieveContext } = require('../embeddings/ragService');
const llmBudget = require('../llmBudget');

const CHAT_MODEL = process.env.CHAT_MODEL || 'claude-haiku-4-5';
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.1:8b';

let anthropicClient = null;

function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropicClient;
}

/**
 * Call Ollama as LLM fallback when Anthropic key is unavailable.
 */
async function callOllama(systemPrompt, messages, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 30000);

  try {
    // Truncate system prompt to keep Ollama fast
    const trimmedSystem = systemPrompt.length > 2000
      ? systemPrompt.slice(0, 2000) + '\n...(מידע נוסף זמין)'
      : systemPrompt;

    const ollamaMessages = [
      { role: 'system', content: trimmedSystem },
      ...messages,
    ];

    const payload = {
      model: OLLAMA_MODEL,
      messages: ollamaMessages,
      stream: false,
      options: {
        temperature: options.temperature ?? 0.3,
        top_p: 0.9,
        num_predict: options.maxTokens || 400,
      },
    };

    const resp = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!resp.ok) return null;

    const data = await resp.json();
    const text = (data.message?.content || '').replace(/^["'"]+|["'"]+$/g, '').trim();
    return text || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

class BaseAgent {
  constructor({ name, description, systemPrompt, ragCategory = null }) {
    this.name = name;
    this.description = description;
    this.systemPrompt = systemPrompt;
    this.ragCategory = ragCategory;
  }

  /**
   * Run the agent with a user query.
   * @param {string} query - The user's question
   * @param {object} context - { userContext, history, userId }
   * @returns {Promise<{answer: string, agent: string, sources: Array, model: string, tokensUsed: number|null}>}
   */
  async run(query, context = {}) {
    const { userContext, history = [], userId } = context;

    // Step 1: Retrieve relevant context via RAG
    const ragResult = await retrieveContext(query, {
      userId,
      category: this.ragCategory,
      topK: 4,
    });

    // Step 2: Build the full prompt with injected context
    const fullSystemPrompt = this.buildFullPrompt(userContext, ragResult.context);

    // Step 3: Call LLM (Claude first, Ollama fallback)
    const client = getClient();

    const historyMessages = (history || [])
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .slice(-6)
      .map(m => ({ role: m.role, content: String(m.content || '').slice(0, 1500) }));

    // Try Claude first
    if (client && llmBudget.canSpend()) {
      try {
        const response = await client.messages.create({
          model: CHAT_MODEL,
          max_tokens: llmBudget.cap(1200),
          temperature: 0.3,
          system: fullSystemPrompt,
          messages: [...historyMessages, { role: 'user', content: query }],
        });

        llmBudget.record(response.usage);

        const text = response.content
          ?.filter(block => block.type === 'text')
          .map(block => block.text)
          .join('')
          .trim();

        return {
          answer: text || 'לא הצלחתי לייצר תשובה.',
          agent: this.name,
          sources: ragResult.sources,
          model: CHAT_MODEL,
          tokensUsed: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0),
        };
      } catch (err) {
        // Fall through to Ollama
      }
    }

    // Ollama fallback
    try {
      const ollamaMessages = [...historyMessages, { role: 'user', content: query }];
      const text = await callOllama(fullSystemPrompt, ollamaMessages);

      if (text) {
        return {
          answer: text,
          agent: this.name,
          sources: ragResult.sources,
          model: `ollama/${OLLAMA_MODEL}`,
          tokensUsed: null,
        };
      }
    } catch {
      // Fall through to error
    }

    return {
      answer: 'שירות ה-AI אינו זמין כרגע. אנא נסה שנית מאוחר יותר.',
      agent: this.name,
      sources: [],
      model: null,
      tokensUsed: null,
    };
  }

  /**
   * Build the full system prompt with user context and RAG context.
   * Subclasses can override this for custom prompt structure.
   */
  buildFullPrompt(userContext, ragContext) {
    const parts = [this.systemPrompt];

    if (ragContext) {
      parts.push(
        '',
        '--- מידע רלוונטי שנמצא במאגר הידע ---',
        ragContext,
        '--- סוף מידע ממאגר ---',
      );
    }

    if (userContext) {
      parts.push('', '--- נתוני המשתמש ---');
      parts.push(this.formatUserContext(userContext));
    }

    parts.push(
      '',
      '--- הנחיות תשובה ---',
      '- ענה בעברית ברורה ומפורטת',
      '- השתמש בנתוני המשתמש כשרלוונטי',
      '- אם חסר מידע — אמור זאת בפשטות',
      '- אל תמציא נתונים',
      '- תן המלצה ניתנת לפעולה כשאפשר',
      '- הוסף: "⚠️ מידע זה הוא לצורכי לימוד בלבד ואינו מהווה ייעוץ פיננסי מקצועי."',
    );

    return parts.join('\n');
  }

  /**
   * Format user context into readable text. Subclasses can override.
   */
  formatUserContext(ctx) {
    if (!ctx) return 'אין נתוני משתמש זמינים.';
    const lines = [];
    if (ctx.employeeName) lines.push(`שם: ${ctx.employeeName}`);
    if (ctx.employerName) lines.push(`מעסיק: ${ctx.employerName}`);
    if (ctx.grossSalary) lines.push(`ברוטו: ${ctx.grossSalary} ₪`);
    if (ctx.netSalary) lines.push(`נטו: ${ctx.netSalary} ₪`);
    if (ctx.tax) lines.push(`מס הכנסה: ${ctx.tax} ₪`);
    if (ctx.nationalInsurance) lines.push(`ביטוח לאומי: ${ctx.nationalInsurance} ₪`);
    if (ctx.pensionEmployee) lines.push(`פנסיה עובד: ${ctx.pensionEmployee} ₪`);
    if (ctx.pensionEmployer) lines.push(`פנסיה מעסיק: ${ctx.pensionEmployer} ₪`);
    if (ctx.trainingFundEmployee) lines.push(`קרן השתלמות עובד: ${ctx.trainingFundEmployee} ₪`);
    if (ctx.trainingFundEmployer) lines.push(`קרן השתלמות מעסיק: ${ctx.trainingFundEmployer} ₪`);
    return lines.length > 0 ? lines.join('\n') : 'אין נתוני תלוש מנותחים.';
  }
}

module.exports = { BaseAgent, getClient, callOllama };
