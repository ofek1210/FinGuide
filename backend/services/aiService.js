const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2:1b';

function cleanAnswer(text) {
  if (!text) return '';
  return text.replace(/^["'“]+|["'”]+$/g, '').trim();
}

async function polishHebrewAnswer(baseText) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const prompt = `
נסח מחדש את המשפט הבא בעברית פשוטה, טבעית, קצרה וברורה.
אל תוסיף נתונים שלא קיימים.
אל תשנה מספרים.
תחזיר רק את המשפט הסופי.

טקסט:
${baseText}
`.trim();

    const payload = {
      model: OLLAMA_MODEL,
      prompt,
      stream: false,
      options: {
        temperature: 0.1,
        top_p: 0.9,
        num_predict: 120,
      },
    };

    const resp = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!resp.ok) {
      return baseText;
    }

    const data = await resp.json();
    const polished = cleanAnswer(data.response || '');

    return polished || baseText;
  } catch (err) {
    return baseText;
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  polishHebrewAnswer,
};