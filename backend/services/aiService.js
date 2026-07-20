const { appendUserFinancialContext } = require('./chatUserContextPrompt');

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.1:8b';

function cleanAnswer(text) {
  if (!text) return '';
  return text.replace(/^["'"]+|["'"]+$/g, '').trim();
}

function buildFinancialSystemPrompt(userContext) {
  const lines = [
    'אתה יועץ פיננסי של אפליקציית FinGuide, המסייע לעובדים בישראל להבין את תלושי השכר שלהם ולנהל את הכספים.',
    'כללים:',
    '- ענה בעברית תקינה, קצרה וברורה.',
    '- השתמש בלשון פנייה ניטרלית מבחינת מגדר (למשל "שכרך" במקום "שכרך/שכרכי").',
    '- אל תמציא נתונים שאינם מופיעים בהקשר שניתן לך.',
    '- אם חסרים נתונים, אמור זאת בפשטות ואל תנחש.',
    '- אל תתן המלצות שלא נשאלת עליהן.',
    '- ענה במשפטים קצרים, ללא כותרות מיותרות.',
    '- כשנשאלת על מדרגות מס, נקודות זיכוי או חישובים, השתמש בנתונים שקיבלת בלבד.',
  ];

  appendUserFinancialContext(lines, userContext, { headingStyle: 'plain' });

  return lines.join('\n');
}

async function callOllamaChat(messages, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 30000);
  const onExternalAbort = () => controller.abort();
  if (options.signal) {
    if (options.signal.aborted) {
      clearTimeout(timeout);
      return null;
    }
    options.signal.addEventListener('abort', onExternalAbort, { once: true });
  }

  try {
    const payload = {
      model: OLLAMA_MODEL,
      messages,
      stream: false,
      options: {
        temperature: options.temperature ?? 0.2,
        top_p: 0.9,
        num_predict: options.maxTokens || 200,
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
    return cleanAnswer(data.message?.content || '') || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
    if (options.signal) {
      options.signal.removeEventListener('abort', onExternalAbort);
    }
  }
}

async function polishHebrewAnswer(baseText) {
  const result = await callOllamaChat(
    [
      {
        role: 'system',
        content: 'נסח מחדש את המשפט שתקבל בעברית פשוטה, טבעית וקצרה. אל תוסיף נתונים. החזר רק את המשפט הסופי.',
      },
      { role: 'user', content: baseText },
    ],
    { temperature: 0.1, maxTokens: 120, timeoutMs: 20000 },
  );
  return result || baseText;
}

/**
 * Ask Ollama for a chat answer. Returns the answer string, or null if unavailable.
 */
async function askLLM(userMessage, userContext, history = [], options = {}) {
  let systemPrompt = typeof options.systemPrompt === 'string' && options.systemPrompt.trim()
    ? options.systemPrompt
    : buildFinancialSystemPrompt(userContext);

  if (!options.systemPrompt) {
    const pageContext = typeof options.pageContext === 'string'
      ? options.pageContext.trim().slice(0, 900)
      : '';
    if (pageContext) {
      systemPrompt +=
        `\n\n--- המסך שהמשתמש צופה בו כעת ---\n` +
        `המשתמש נמצא כעת במסך: ${pageContext}.\n` +
        `אם השאלה כללית (למשל "מה זה?", "מה עושה הדף הזה?", "תסביר לי את זה") — ` +
        `התייחס למסך הנוכחי הזה ולא לנתוני התלוש. ` +
        `אל תתאר תלוש שכר ספציפי או שם עובד/מעסיק אלא אם המשתמש ביקש זאת במפורש.`;
    }
  }

  const historyMessages = Array.isArray(history)
    ? history
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .slice(-6)
        .map(m => ({ role: m.role, content: String(m.content || '').slice(0, 1000) }))
    : [];

  return callOllamaChat(
    [
      { role: 'system', content: systemPrompt },
      ...historyMessages,
      { role: 'user', content: userMessage },
    ],
    { temperature: 0.2, maxTokens: 500, timeoutMs: 45000, signal: options.signal },
  );
}

/**
 * Stream Ollama chat tokens via onToken. Resolves to full text or null.
 */
async function streamLLM(userMessage, userContext, history = [], options = {}, onToken) {
  let systemPrompt = typeof options.systemPrompt === 'string' && options.systemPrompt.trim()
    ? options.systemPrompt
    : buildFinancialSystemPrompt(userContext);

  if (!options.systemPrompt) {
    const pageContext = typeof options.pageContext === 'string'
      ? options.pageContext.trim().slice(0, 900)
      : '';
    if (pageContext) {
      systemPrompt +=
        `\n\n--- המסך שהמשתמש צופה בו כעת ---\n` +
        `המשתמש נמצא כעת במסך: ${pageContext}.\n` +
        `אם השאלה כללית — התייחס למסך הנוכחי.`;
    }
  }

  const historyMessages = Array.isArray(history)
    ? history
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .slice(-6)
        .map(m => ({ role: m.role, content: String(m.content || '').slice(0, 1000) }))
    : [];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 45000);
  const onExternalAbort = () => controller.abort();
  if (options.signal) {
    if (options.signal.aborted) {
      clearTimeout(timeout);
      return null;
    }
    options.signal.addEventListener('abort', onExternalAbort, { once: true });
  }

  try {
    const resp = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          ...historyMessages,
          { role: 'user', content: userMessage },
        ],
        stream: true,
        options: {
          temperature: 0.2,
          top_p: 0.9,
          num_predict: options.maxTokens || 500,
        },
      }),
      signal: controller.signal,
    });

    if (!resp.ok || !resp.body) return null;

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let full = '';

    while (true) {
      if (options.signal?.aborted) {
        try { await reader.cancel(); } catch { /* ignore */ }
        break;
      }
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const chunk = JSON.parse(trimmed);
          const token = chunk.message?.content || '';
          if (token) {
            full += token;
            if (typeof onToken === 'function') onToken(token);
          }
        } catch {
          // skip bad json lines
        }
      }
    }

    return cleanAnswer(full) || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
    if (options.signal) {
      options.signal.removeEventListener('abort', onExternalAbort);
    }
  }
}

module.exports = { polishHebrewAnswer, askLLM, streamLLM, buildFinancialSystemPrompt };
