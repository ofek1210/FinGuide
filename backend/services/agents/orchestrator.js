/**
 * Orchestrator Agent — routes user queries to the appropriate specialist agent.
 *
 * Architecture:
 * 1. User asks a question
 * 2. Orchestrator classifies the intent (using Claude or rules)
 * 3. Routes to the specialist agent (payslip, pension, analysis, planning, insurance)
 * 4. Returns the answer with metadata about which agent handled it
 *
 * Fallback: if no specialist matches, the orchestrator handles it directly as a general assistant.
 */

const { getClient, callOllama } = require('./baseAgent');
const llmBudget = require('../llmBudget');
const payslipAgent = require('./payslipAgent');
const pensionAgent = require('./pensionAgent');
const financialAnalysisAgent = require('./financialAnalysisAgent');
const financialPlanningAgent = require('./financialPlanningAgent');
const insuranceAgent = require('./insuranceAgent');

const CHAT_MODEL = process.env.CHAT_MODEL || 'claude-haiku-4-5';

// Agent registry
const AGENTS = {
  payslip_analysis: payslipAgent,
  pension_advisor: pensionAgent,
  financial_analysis: financialAnalysisAgent,
  financial_planning: financialPlanningAgent,
  insurance_benefits: insuranceAgent,
};

/**
 * Classify which agent should handle the query.
 * First tries rule-based classification, then falls back to LLM classification.
 * @param {string} query
 * @returns {Promise<string>} agent key or 'general'
 */
async function classifyIntent(query) {
  // Rule-based classification first (fast, no LLM cost)
  const q = query.toLowerCase();

  // Payslip analysis
  if (
    q.includes('תלוש') || q.includes('payslip') || q.includes('סכם') ||
    q.includes('הסבר את') || q.includes('מה זה נטו') || q.includes('מה זה ברוטו') ||
    q.includes('שדות') || q.includes('רכיבי שכר')
  ) {
    return 'payslip_analysis';
  }

  // Pension
  if (
    q.includes('פנסיה') || q.includes('pension') || q.includes('קרן השתלמות') ||
    q.includes('study fund') || q.includes('הפרשה') || q.includes('הפרשות') ||
    q.includes('פיצויים') || q.includes('severance') || q.includes('דמי ניהול')
  ) {
    return 'pension_advisor';
  }

  // Insurance
  if (
    q.includes('ביטוח') || q.includes('insurance') || q.includes('פוליסה') ||
    q.includes('אכ"ע') || q.includes('אובדן כושר') || q.includes('כיסוי')
  ) {
    return 'insurance_benefits';
  }

  // Financial planning
  if (
    q.includes('תכנון') || q.includes('חיסכון') || q.includes('תקציב') ||
    q.includes('פרישה') || q.includes('retirement') || q.includes('עתיד') ||
    q.includes('כמה לחסוך') || q.includes('50/30/20') || q.includes('השקעה') ||
    q.includes('planning') || q.includes('קרן חירום')
  ) {
    return 'financial_planning';
  }

  // Financial analysis
  if (
    q.includes('ניתוח') || q.includes('analysis') || q.includes('מגמה') ||
    q.includes('חריגה') || q.includes('anomaly') || q.includes('למה ירד') ||
    q.includes('למה עלה') || q.includes('שינוי') || q.includes('השוואה')
  ) {
    return 'financial_analysis';
  }

  // LLM-based classification as fallback
  const classificationSystemPrompt = `סווג את השאלה הבאה לאחת מהקטגוריות:
- payslip_analysis: שאלות על תלוש שכר, הסבר שדות, סיכום תלוש
- pension_advisor: פנסיה, קרן השתלמות, הפרשות, פיצויים
- financial_analysis: ניתוח מגמות, חריגות, השוואות
- financial_planning: תכנון פיננסי, חיסכון, תקציב, פרישה
- insurance_benefits: ביטוחים, כיסויים, המלצות ביטוח
- general: שאלות כלליות, שלום, עזרה

החזר רק את שם הקטגוריה, בלי הסבר.`;

  const client = getClient();
  if (client && llmBudget.canSpend()) {
    try {
      const response = await client.messages.create({
        model: CHAT_MODEL,
        max_tokens: 50,
        temperature: 0,
        system: classificationSystemPrompt,
        messages: [{ role: 'user', content: query }],
      });

      llmBudget.record(response.usage);

      const classification = response.content?.[0]?.text?.trim().toLowerCase();
      if (classification && AGENTS[classification]) {
        return classification;
      }
    } catch {
      // Fall through to Ollama classification
    }
  }

  // Ollama classification fallback
  try {
    const result = await callOllama(classificationSystemPrompt, [{ role: 'user', content: query }], { maxTokens: 50, temperature: 0 });
    if (result) {
      const classification = result.trim().toLowerCase();
      if (AGENTS[classification]) {
        return classification;
      }
    }
  } catch {
    // Fall through to general
  }

  return 'general';
}

/**
 * Main orchestrator entry point.
 * Classifies the query and routes to the appropriate agent.
 * @param {string} query - User's question
 * @param {object} context - { userContext, history, userId }
 * @returns {Promise<{answer: string, agent: string, classification: string, sources: Array, model: string, tokensUsed: number|null}>}
 */
async function orchestrate(query, context = {}) {
  // Step 1: Classify intent
  const classification = await classifyIntent(query);

  // Step 2: Route to specialist agent or handle as general
  if (classification !== 'general' && AGENTS[classification]) {
    const agent = AGENTS[classification];
    const result = await agent.run(query, context);
    return {
      ...result,
      classification,
    };
  }

  // Step 3: General fallback — orchestrator handles directly
  const { retrieveContext } = require('../embeddings/ragService');
  const ragResult = await retrieveContext(query, {
    userId: context.userId,
    topK: 3,
  });

  const systemPrompt = buildOrchestratorPrompt(context.userContext, ragResult.context);
  const historyMessages = (context.history || [])
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .slice(-6)
    .map(m => ({ role: m.role, content: String(m.content || '').slice(0, 1500) }));

  // Try Claude first
  const client = getClient();
  if (client && llmBudget.canSpend()) {
    try {
      const response = await client.messages.create({
        model: CHAT_MODEL,
        max_tokens: llmBudget.cap(1200),
        temperature: 0.3,
        system: systemPrompt,
        messages: [...historyMessages, { role: 'user', content: query }],
      });

      llmBudget.record(response.usage);

      const text = response.content
        ?.filter(block => block.type === 'text')
        .map(block => block.text)
        .join('')
        .trim();

      return {
        answer: text || 'לא הצלחתי לענות.',
        agent: 'orchestrator',
        classification: 'general',
        sources: ragResult.sources,
        model: CHAT_MODEL,
        tokensUsed: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0),
      };
    } catch {
      // Fall through to Ollama
    }
  }

  // Ollama fallback
  try {
    const ollamaMessages = [...historyMessages, { role: 'user', content: query }];
    const text = await callOllama(systemPrompt, ollamaMessages);

    if (text) {
      return {
        answer: text,
        agent: 'orchestrator',
        classification: 'general',
        sources: ragResult.sources,
        model: `ollama/${process.env.OLLAMA_MODEL || 'llama3.1:8b'}`,
        tokensUsed: null,
      };
    }
  } catch {
    // Fall through to error
  }

  return {
    answer: 'שירות ה-AI אינו זמין כרגע. נסה שנית מאוחר יותר.',
    agent: 'orchestrator',
    classification: 'general',
    sources: [],
    model: null,
    tokensUsed: null,
  };
}

function buildOrchestratorPrompt(userContext, ragContext) {
  const lines = [
    'אתה עוזר פיננסי חכם של FinGuide — מערכת מבוססת AI לניהול כספים אישיים.',
    'ענה בעברית, בצורה ברורה ומועילה.',
    'אם אינך בטוח בתשובה — אמור זאת.',
    'אל תמציא נתונים.',
  ];

  if (ragContext) {
    lines.push('', '--- מידע רלוונטי ---', ragContext);
  }

  if (userContext?.grossSalary) {
    lines.push('', '--- נתוני משתמש ---');
    lines.push(`ברוטו: ${userContext.grossSalary} ₪`);
    if (userContext.netSalary) lines.push(`נטו: ${userContext.netSalary} ₪`);
  }

  return lines.join('\n');
}

/**
 * Get the list of available agents and their descriptions.
 */
function getAgentList() {
  return Object.entries(AGENTS).map(([key, agent]) => ({
    id: key,
    name: agent.name,
    description: agent.description,
  }));
}

module.exports = { orchestrate, classifyIntent, getAgentList };
