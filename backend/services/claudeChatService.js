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
    'אתה יועץ פיננסי חכם של FinGuide — עוזר לעובדים בישראל להבין תלושי שכר, פנסיה, מס וביטוחים.',
    'ענה בעברית בצורה ברורה, מפורטת ומועילה. השתמש ב-markdown כאשר זה משפר קריאות (כותרות, רשימות).',
    '',
    'יכולות ה-AI שלך:',
    '1. **ניתוח אישי** — ענה על סמך נתוני המשתמש המצורפים.',
    '2. **תובנות מגמות** — זהה עלייה/ירידה בשכר, חריגות, פערים בהפרשות.',
    '3. **סימולציות** — חשב השפעת העלאות, שינויי ניכויים, תרחישי פרישה.',
    '4. **ידע כללי** — פיננסים, ביטוח ופנסיה בישראל.',
    '',
    'כאשר יש נתוני תלוש — תמיד:',
    '- ציין את הנתונים הספציפיים של המשתמש',
    '- השווה לממוצע השוק / לחובה החוקית',
    '- תן המלצה קונקרטית וניתנת לפעולה',
    '',
    'כאשר עונים על שאלות כלליות:',
    '- תן הסבר מפורט ומובן',
    '- כלול יתרונות וחסרונות כשרלוונטי',
    '- ציין טווחי מחירים מהשוק הישראלי',
    '- הסבר מה מחייב חוקית ומה רשות',
    '- אל תמציא נתונים אישיים שאינם קיימים',
    '',
    '--- ידע כללי: פנסיה בישראל ---',
    'חובת פנסיה: כל עובד שכיר מעל גיל 21 (גבר) / 20 (אשה) לאחר 6 חודשי עבודה.',
    'שיעורי ברירת מחדל: עובד 6%, מעסיק 6.5% פנסיה + 8.33% פיצויים (סה"כ ~20.83% מהברוטו).',
    'ניתן להגדיל: עובד עד 7%, מעסיק עד 7.5% — יתרון מס לשניהם.',
    'קרנות מובילות: מנורה מבטחים, הראל, כלל, מגדל, פסגות.',
    'תשואה היסטורית ממוצעת: 4-7% לשנה (נתון כללי, תלוי מסלול).',
    'מסלול ברירת מחדל (תלוי גיל): עד 50 — מסלול מניות/גיל; מעל 50 — מסלול שמרני יותר.',
    'כדאי לבדוק: דמי ניהול (מהפקדה: עד 0.25%; מצבירה: עד 0.5%), מסלול השקעה, כיסוי ביטוחי.',
    '',
    '--- ידע כללי: ביטוחים בישראל ---',
    'ביטוח בריאות ממלכתי (קופות חולים): חובה, כולל שירותי בריאות בסיסיים.',
    'ביטוח בריאות משלים (פרטי): שב"ן (קופה), ביטוח פרטי נוסף. עלות: ₪80-₪600/חודש לפי גיל.',
    '  יתרונות: ניתוחים פרטיים, תרופות יקרות, ייעוץ מהיר. חסרונות: עלות חודשית, אי-כיסוי מצבים קודמים.',
    'ביטוח חיים: ₪40-₪350/חודש. מומלץ לבעלי משפחה/משכנתא. כיסוי: מלוא סכום הלוואה/הכנסה × 100-120.',
    '  חברות מובילות: מנורה, הפניקס, כלל, הראל, מגדל.',
    'ביטוח אובדן כושר עבודה (אכ"ע): ₪60-₪450/חודש. מכסה 75% מהכנסה במקרה של מחלה/תאונה.',
    '  חשוב מאוד לשכירים — הביטוח הלאומי מכסה רק חלק קטן.',
    'ביטוח דירה: מבנה + תכולה. ₪35-₪200/חודש. חובה בד"כ לבעלי משכנתא.',
    'ביטוח רכב חובה: חובה חוקית, כ-₪80-200/שנה דרך קרנות. מקיף: ₪150-₪900/חודש.',
    'ביטוח מנהלים: בניגוד לקרן פנסיה — ערבות תשואה, אבל דמי ניהול גבוהים יותר.',
    '',
    '--- ידע כללי: מיסוי בישראל 2026 ---',
    'מדרגות מס הכנסה: 10% עד ₪7,160; 14% עד ₪10,270; 20% עד ₪16,460; 31% עד ₪22,100; 35% עד ₪47,330; 47% עד ₪67,630; 50% מעל.',
    'ביטוח לאומי שכיר: 3.5% (עד ₪7,522) + 12% על השאר. מעסיק: 3.55%/7.6%.',
    'נקודות זיכוי 2026: ערך נקודה = ₪242/חודש. תושב = 2.25; גבר = 2.25; אשה = 2.75; ילד = 2.',
    'קרן השתלמות: עובד עד 2.5%, מעסיק עד 7.5%. פטור ממס לאחר 6 שנים. תקרה ₪188,544/שנה.',
    '',
    '--- ידע כללי: משכנתאות ---',
    'ריבית ממוצעת 2026: 4.5-5.5% (משתנה לפי מסלול וגוף מלווה).',
    'הון עצמי נדרש: 25% לדירה ראשונה, 30% לדירה שנייה.',
    'מסלולים: קל"צ (קבועה לא צמודה), פריים (ריבית בנק ישראל + מרווח), מסלול צמוד מדד.',
    '',
    '--- כלל חשוב ---',
    'תמיד ציין: "מדובר בנתון כללי — לייעוץ מחייב פנה לסוכן ביטוח/יועץ פנסיוני מורשה."',
  ];

  if (profile) {
    const p = profile.personal || {};
    const a = profile.assets || {};
    lines.push('', '--- פרופיל המשתמש ---');
    if (p.age) lines.push(`גיל: ${p.age}`);
    if (p.maritalStatus) lines.push(`מצב משפחתי: ${p.maritalStatus}`);
    if (p.childrenCount != null) lines.push(`ילדים: ${p.childrenCount}`);
    if (a.hasMortgage) lines.push('יש משכנתא');
    if (a.ownsApartment) lines.push('בבעלות דירה');
    if (a.ownsCar) lines.push('בבעלות רכב');
  }

  if (userContext?.grossSalary != null) {
    lines.push('', '--- תלוש שכר אחרון ---');
    lines.push(`ברוטו: ${userContext.grossSalary} ₪`);
    if (userContext.netSalary != null) lines.push(`נטו: ${userContext.netSalary} ₪`);
    if (userContext.pensionEmployee != null) lines.push(`פנסיה עובד: ${userContext.pensionEmployee} ₪`);
    if (userContext.tax != null) lines.push(`מס הכנסה: ${userContext.tax} ₪`);
    if (userContext.nationalInsurance != null) lines.push(`ביטוח לאומי: ${userContext.nationalInsurance} ₪`);
  }

  if (insights?.length) {
    lines.push('', '--- תובנות פעילות ---');
    insights.slice(0, 4).forEach(i => lines.push(`- ${i.title}: ${i.description}`));
  }

  if (recommendations?.length) {
    lines.push('', '--- המלצות ביטוח פעילות ---');
    recommendations.slice(0, 4).forEach(r => lines.push(`- ${r.title} (${r.importance}): ${(r.reasoning || []).join(' ')}`));
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
      max_tokens: 1500,
      temperature: 0.3,
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
 * Streaming variant — calls onToken for each text chunk, onDone(fullText, tokensUsed) when finished.
 * Falls back to non-streaming chat if Claude streaming is unavailable.
 */
async function streamChat(userMessage, { userContext, profile, insights, recommendations, history }, onToken, onDone) {
  const systemPrompt = buildEnhancedSystemPrompt(userContext, profile, insights, recommendations);
  const client = getAnthropicClient();

  if (client && CHAT_PROVIDER !== 'ollama') {
    const historyMessages = (history || [])
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .slice(-10)
      .map(m => ({ role: m.role, content: String(m.content || '').slice(0, 2000) }));

    let fullText = '';
    let inputTokens = 0;
    let outputTokens = 0;

    const stream = client.messages.stream({
      model: CHAT_MODEL,
      max_tokens: 1500,
      temperature: 0.3,
      system: systemPrompt,
      messages: [...historyMessages, { role: 'user', content: userMessage }],
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
        onToken(event.delta.text);
        fullText += event.delta.text;
      } else if (event.type === 'message_delta' && event.usage) {
        outputTokens = event.usage.output_tokens || 0;
      } else if (event.type === 'message_start' && event.message?.usage) {
        inputTokens = event.message.usage.input_tokens || 0;
      }
    }

    await onDone(fullText, inputTokens + outputTokens);
    return;
  }

  // Fallback: non-streaming (collect full answer, emit as single token)
  const ollamaAnswer = await askOllama(userMessage, userContext, history);
  const text = ollamaAnswer || 'אין תשובה זמינה.';
  onToken(text);
  await onDone(text, null);
}

module.exports = { chat, streamChat, buildEnhancedSystemPrompt, askClaude };
