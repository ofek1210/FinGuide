const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2:1b';

function cleanAnswer(text) {
  if (!text) return '';
  return text.replace(/^["'"]+|["'"]+$/g, '').trim();
}

function buildFinancialSystemPrompt(userContext) {
  const lines = [
    'אתה עוזר פיננסי של FinGuide, המסייע לעובדים בישראל להבין תלושי שכר.',
    'כללים:',
    '- ענה בעברית תקינה, קצרה וברורה בלבד.',
    '- אל תמציא נתונים שאינם מופיעים בהקשר שניתן לך.',
    '- אם חסרים נתונים, אמור זאת בפשטות.',
    '- אל תתן המלצות שלא נשאלת עליהן.',
    '- ענה במשפטים קצרים, ללא כותרות מיותרות.',
  ];

  const hasData = userContext?.grossSalary != null || userContext?.netSalary != null;

  if (hasData) {
    lines.push('', 'נתוני תלוש שכר אחרון של המשתמש:');
    if (userContext.grossSalary != null) lines.push(`ברוטו: ${userContext.grossSalary} ₪`);
    if (userContext.netSalary != null) lines.push(`נטו: ${userContext.netSalary} ₪`);
    if (userContext.tax != null) lines.push(`מס הכנסה: ${userContext.tax} ₪`);
    if (userContext.nationalInsurance != null) lines.push(`ביטוח לאומי: ${userContext.nationalInsurance} ₪`);
    if (userContext.healthInsurance != null) lines.push(`ביטוח בריאות: ${userContext.healthInsurance} ₪`);
    if (userContext.pensionEmployee != null) lines.push(`פנסיה עובד: ${userContext.pensionEmployee} ₪`);
    if (userContext.pensionEmployer != null) lines.push(`פנסיה מעסיק: ${userContext.pensionEmployer} ₪`);
    if (userContext.trainingFundEmployee != null) lines.push(`קרן השתלמות עובד: ${userContext.trainingFundEmployee} ₪`);
    if (userContext.trainingFundEmployer != null) lines.push(`קרן השתלמות מעסיק: ${userContext.trainingFundEmployer} ₪`);
    if (userContext.trainingFundEmployeePercent != null) lines.push(`אחוז קרן השתלמות עובד: ${userContext.trainingFundEmployeePercent}%`);
    if (userContext.trainingFundEmployerPercent != null) lines.push(`אחוז קרן השתלמות מעסיק: ${userContext.trainingFundEmployerPercent}%`);
    if (userContext.marginalTaxRate != null) lines.push(`שיעור מס שולי: ${userContext.marginalTaxRate}%`);
    if (userContext.taxCreditPoints != null) lines.push(`נקודות זיכוי: ${userContext.taxCreditPoints}`);
    if (userContext.jobPercentage != null) lines.push(`אחוז משרה: ${userContext.jobPercentage}%`);
    if (userContext.payslipDate) lines.push(`תאריך תלוש: ${userContext.payslipDate}`);
  } else {
    lines.push('', 'אין עדיין נתוני תלוש שכר מנותחים עבור המשתמש.');
  }

  if (userContext?.documents?.length) {
    lines.push(`סה"כ מסמכים במערכת: ${userContext.documents.length}`);
  }

  return lines.join('\n');
}

async function callOllamaChat(messages, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 30000);

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

async function askLLM(userMessage, userContext) {
  const systemPrompt = buildFinancialSystemPrompt(userContext);
  const fallback =
    'מצטערת, לא הצלחתי לענות על זה כרגע. נסי לשאול שאלה ספציפית כמו: "כמה נטו?", "כמה פנסיה?" או "תסכם מסמכים".';

  const result = await callOllamaChat(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    { temperature: 0.2, maxTokens: 250, timeoutMs: 30000 },
  );

  return result || fallback;
}

module.exports = { polishHebrewAnswer, askLLM };
