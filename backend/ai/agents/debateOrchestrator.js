

/**
 * Agent Debate Council — domain agents present positions, rebut each other,
 * and a judge agent ranks final priorities for the user.
 */

const { runPayslipAgent } = require('./payslipAgent');
const { runInsuranceAgent } = require('./insuranceAgent');
const { runPensionAgent } = require('./pensionAgent');
const { askClaude } = require('../../services/claudeChatService');
const {
  MOCK_PAYSLIP_AGENT_RESULT,
  MOCK_INSURANCE_AGENT_RESULT,
  MOCK_PENSION_AGENT_RESULT,
} = require('../mock/mockData');

const AGENT_META = {
  payslip: { labelHe: 'סוכן השכר', domainHe: 'תלושים' },
  insurance: { labelHe: 'סוכן הביטוח', domainHe: 'ביטוחים' },
  pension: { labelHe: 'סוכן הפנסיה', domainHe: 'פנסיה' },
  profile: { labelHe: 'סוכן הפרופיל', domainHe: 'פרופיל' },
};

const URGENCY_WEIGHT = { high: 3, medium: 2, low: 1 };

function sleep(ms) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

async function emitSequentially(items, emitFn, delayMs = 0) {
  await items.reduce(
    (chain, item) =>
      chain.then(async () => {
        emitFn(item);
        if (delayMs > 0) await sleep(delayMs);
      }),
    Promise.resolve(),
  );
}

function urgencyScore(rec) {
  const base = URGENCY_WEIGHT[rec?.urgency] || 1;
  const confidence = Number(rec?.confidenceScore);
  const bonus = Number.isFinite(confidence) ? confidence / 100 : 0.5;
  return base + bonus;
}

function pickTopRecommendation(agentResult) {
  const recs = agentResult?.recommendations || [];
  if (!recs.length) return null;
  return [...recs].sort((a, b) => urgencyScore(b) - urgencyScore(a))[0];
}

function buildPosition(agentId, agentResult) {
  const top = pickTopRecommendation(agentResult);
  if (!top) {
    return {
      agentId,
      labelHe: AGENT_META[agentId]?.labelHe || agentId,
      domainHe: AGENT_META[agentId]?.domainHe || agentId,
      title: agentResult?.message || 'אין המלצה דחופה כרגע',
      reason: agentResult?.llmExplanation || agentResult?.explanation || 'אין מספיק נתונים לעמדה.',
      urgency: 'low',
      financialImpact: null,
      priorityScore: 0.5,
    };
  }

  return {
    agentId,
    labelHe: AGENT_META[agentId]?.labelHe || agentId,
    domainHe: AGENT_META[agentId]?.domainHe || agentId,
    title: top.title,
    reason: top.reason || top.title,
    urgency: top.urgency || 'medium',
    financialImpact: top.financialImpact || null,
    priorityScore: urgencyScore(top),
  };
}

/** Rule-based cross-agent rebuttals when LLM is unavailable. */
function buildRuleRebuttals(positions) {
  const rebuttals = [];
  const byId = Object.fromEntries(positions.map(p => [p.agentId, p]));

  if (byId.insurance?.priorityScore >= 2 && byId.pension) {
    rebuttals.push({
      fromAgent: 'insurance',
      toAgent: 'pension',
      stance: 'challenge',
      text: 'פער ביטוחי (כמו אובדן כושר עבודה) עלול לעלות יותר מחיסכון פנסיוני עתידי — כדאי לסגור את החור לפני אופטימיזציה.',
    });
  }

  if (byId.pension?.priorityScore >= 2 && byId.insurance) {
    rebuttals.push({
      fromAgent: 'pension',
      toAgent: 'insurance',
      stance: 'challenge',
      text: 'דמי ניהול גבוהים או הפקדות חסרות לפנסיה שוחקים עשרות אלפי שקלים לאורך שנים — זה לא פחות דחוף מביטוח חודשי.',
    });
  }

  if (byId.payslip?.priorityScore >= 2 && byId.pension) {
    rebuttals.push({
      fromAgent: 'payslip',
      toAgent: 'pension',
      stance: 'support',
      text: 'אם יש פער בהפרשות מהתלוש — זה המקום להתחיל: תיקון מיידי בלי לשנות את מבנה הפנסיה.',
    });
  }

  if (byId.payslip?.priorityScore >= 2 && byId.insurance) {
    rebuttals.push({
      fromAgent: 'payslip',
      toAgent: 'insurance',
      stance: 'neutral',
      text: 'כדאי לוודא שהניכויים בתלוש תואמים את מה שבפועל מכוסה — לפעמים יש כפל ביטוחי שמורגש רק בתלוש.',
    });
  }

  return rebuttals;
}

function buildRuleVerdict(positions, rebuttals) {
  const ranked = [...positions]
    .filter(p => p.priorityScore > 0)
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .map((p, index) => ({
      rank: index + 1,
      agentId: p.agentId,
      labelHe: p.labelHe,
      title: p.title,
      urgency: p.urgency,
      financialImpact: p.financialImpact,
    }));

  const top = ranked[0];
  const second = ranked[1];
  let summaryHe = 'לא נמצאו עדיפויות ברורות — העלה תלושים וייבא נתוני פנסיה/ביטוח.';

  if (top && second) {
    summaryHe =
      `לאחר דיון בין הסוכנים, העדיפות הראשונה: ${top.labelHe} — ${top.title}. ` +
      `מיד אחריו: ${second.labelHe} — ${second.title}. ` +
      `${rebuttals.length ? 'הסוכנים חלקו על סדר העדיפויות וניתחו את ההשפעה הכספית.' : ''}`;
  } else if (top) {
    summaryHe = `העדיפות המרכזית: ${top.labelHe} — ${top.title}.`;
  }

  return {
    rankedPriorities: ranked,
    summaryHe,
    judgeReasoning: 'פסיקה מבוססת כללים: דחיפות, השפעה כספית, ונקודות מחלוקת בין הסוכנים.',
    source: 'rule',
  };
}

async function buildLlmVerdict(positions, rebuttals) {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  const context = JSON.stringify({ positions, rebuttals }, null, 2);
  const systemPrompt =
    'אתה שופט פיננסי ב-FinGuide. קיבלת עמדות של סוכני דומיין (שכר, ביטוח, פנסיה) ותגובות הדדיות. ' +
    'החזר JSON בלבד: {"rankedPriorities":[{"rank":1,"agentId":"...","title":"..."}], "summaryHe":"...", "judgeReasoning":"..."} ' +
    'summaryHe בעברית, 3-4 משפטים, מסביר למה סדר העדיפויות הזה.';

  try {
    const result = await askClaude(`עמדות ודיון:\n${context}`, systemPrompt, []);
    const raw = result?.answer || '';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed.rankedPriorities) || !parsed.summaryHe) return null;
    return {
      rankedPriorities: parsed.rankedPriorities.map((item, index) => ({
        rank: item.rank ?? index + 1,
        agentId: item.agentId,
        labelHe: AGENT_META[item.agentId]?.labelHe || item.agentId,
        title: item.title,
        urgency: positions.find(p => p.agentId === item.agentId)?.urgency,
        financialImpact: positions.find(p => p.agentId === item.agentId)?.financialImpact,
      })),
      summaryHe: parsed.summaryHe,
      judgeReasoning: parsed.judgeReasoning || 'פסיקה מבוססת LLM.',
      source: 'llm',
    };
  } catch {
    return null;
  }
}

async function runAgentDebate(userId, { skipLLM = false } = {}) {
  const startedAt = Date.now();
  const debateId = `debate_${userId}_${startedAt}`;

  const [payslip, insurance, pension] = await Promise.all([
    runPayslipAgent(userId, { skipLLM: true }),
    runInsuranceAgent(userId, { skipLLM: true }),
    runPensionAgent(userId, { skipLLM: true }),
  ]);

  const agentResults = { payslip, insurance, pension };
  const positions = ['payslip', 'insurance', 'pension'].map(id =>
    buildPosition(id, agentResults[id]),
  );
  const rebuttals = buildRuleRebuttals(positions);

  let verdict = buildRuleVerdict(positions, rebuttals);
  if (!skipLLM) {
    const llmVerdict = await buildLlmVerdict(positions, rebuttals);
    if (llmVerdict) verdict = llmVerdict;
  }

  return {
    success: true,
    debateId,
    positions,
    rebuttals,
    verdict,
    meta: {
      durationMs: Date.now() - startedAt,
      source: verdict.source,
      isDemo: false,
    },
  };
}

function buildDemoDebate() {
  const agentResults = {
    payslip: MOCK_PAYSLIP_AGENT_RESULT,
    insurance: MOCK_INSURANCE_AGENT_RESULT,
    pension: MOCK_PENSION_AGENT_RESULT,
  };
  const positions = ['payslip', 'insurance', 'pension'].map(id =>
    buildPosition(id, agentResults[id]),
  );
  const rebuttals = buildRuleRebuttals(positions);
  const verdict = buildRuleVerdict(positions, rebuttals);
  verdict.summaryHe =
    'לאחר דיון פתוח בין הסוכנים: (1) סוכן הביטוח דורש כיסוי אובדן כושר עבודה — סיכון מיידי; ' +
    '(2) סוכן הפנסיה מזהה דמי ניהול גבוהים ששוחקים חיסכון לטווח ארוך; ' +
    '(3) סוכן השכר מאשר מגמת עלייה בשכר — בסיס טוב לתיקון הפרשות. ' +
    'המלצה: לסגור את פער הביטוח, ואז לטפל בדמי הניהול בפנסיה.';
  verdict.source = 'demo';

  return {
    success: true,
    debateId: 'debate_demo',
    positions,
    rebuttals,
    verdict,
    meta: { durationMs: 1200, source: 'demo', isDemo: true },
  };
}

/**
 * Stream debate phases via callback (for SSE).
 * @param {string} userId
 * @param {{ skipLLM?: boolean, demo?: boolean, onEvent: (evt: object) => void }} opts
 */
async function streamAgentDebate(userId, { skipLLM = false, demo = false, onEvent }) {
  const emit = evt => onEvent?.(evt);

  if (demo) {
    emit({ type: 'phase', phase: 'positions', labelHe: 'הסוכנים מציגים עמדות…' });
    await sleep(400);
    const demoResult = buildDemoDebate();
    await emitSequentially(
      demoResult.positions,
      position => emit({ type: 'position', ...position }),
      350,
    );
    emit({ type: 'phase', phase: 'rebuttals', labelHe: 'סבב תגובות והתנגדויות…' });
    await sleep(300);
    await emitSequentially(
      demoResult.rebuttals,
      rebuttal => emit({ type: 'rebuttal', ...rebuttal }),
      400,
    );
    emit({ type: 'phase', phase: 'verdict', labelHe: 'השופט מסכם…' });
    await sleep(500);
    emit({ type: 'verdict', ...demoResult.verdict });
    emit({ type: 'done', debateId: demoResult.debateId, meta: demoResult.meta });
    return demoResult;
  }

  emit({ type: 'phase', phase: 'positions', labelHe: 'הסוכנים מנתחים נתונים…' });

  const [payslip, insurance, pension] = await Promise.all([
    runPayslipAgent(userId, { skipLLM: true }),
    runInsuranceAgent(userId, { skipLLM: true }),
    runPensionAgent(userId, { skipLLM: true }),
  ]);

  const agentResults = { payslip, insurance, pension };
  const positions = ['payslip', 'insurance', 'pension'].map(id =>
    buildPosition(id, agentResults[id]),
  );

  positions.forEach(position => {
    emit({ type: 'position', ...position });
  });

  emit({ type: 'phase', phase: 'rebuttals', labelHe: 'סבב תגובות…' });
  const rebuttals = buildRuleRebuttals(positions);
  rebuttals.forEach(rebuttal => {
    emit({ type: 'rebuttal', ...rebuttal });
  });

  emit({ type: 'phase', phase: 'verdict', labelHe: 'השופט מדרג עדיפויות…' });
  let verdict = buildRuleVerdict(positions, rebuttals);
  if (!skipLLM) {
    const llmVerdict = await buildLlmVerdict(positions, rebuttals);
    if (llmVerdict) verdict = llmVerdict;
  }

  const debateId = `debate_${userId}_${Date.now()}`;
  emit({ type: 'verdict', ...verdict });
  emit({
    type: 'done',
    debateId,
    meta: { durationMs: 0, source: verdict.source, isDemo: false },
  });

  return { success: true, debateId, positions, rebuttals, verdict };
}

module.exports = {
  runAgentDebate,
  streamAgentDebate,
  buildDemoDebate,
};
