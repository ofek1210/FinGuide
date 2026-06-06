/**
 * Monthly AI Report Service
 * Generates a personalized monthly financial report using Claude.
 * Uses streaming-compatible or one-shot Claude call.
 */
const Anthropic = require('@anthropic-ai/sdk');

let anthropicClient = null;
function getClient() {
  if (!anthropicClient && process.env.ANTHROPIC_API_KEY) {
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropicClient;
}

const REPORT_MODEL = process.env.CHAT_MODEL || 'claude-sonnet-4-20250514';

function buildReportContext({ profile, budgetAnalysis, investmentRecs, healthScore, insights, latestPayslip }) {
  const lines = [
    `תאריך הדוח: ${new Date().toLocaleDateString('he-IL', { year: 'numeric', month: 'long' })}`,
    '',
  ];

  if (latestPayslip) {
    lines.push(`שכר ברוטו אחרון: ₪${(latestPayslip.grossSalary || 0).toLocaleString('he-IL')}`);
    lines.push(`שכר נטו אחרון: ₪${(latestPayslip.netSalary || 0).toLocaleString('he-IL')}`);
    if (latestPayslip.pensionEmployee) lines.push(`הפרשה לפנסיה (עובד): ₪${latestPayslip.pensionEmployee.toLocaleString('he-IL')}`);
    if (latestPayslip.tax) lines.push(`מס הכנסה: ₪${latestPayslip.tax.toLocaleString('he-IL')}`);
  }

  if (budgetAnalysis?.available) {
    lines.push('', `יחס חיסכון: ${budgetAnalysis.savingsRate}`);
    lines.push(`מצב תקציב: ${budgetAnalysis.health.label}`);
    lines.push(`תזרים חופשי חודשי: ₪${(budgetAnalysis.monthlyFreeFlow || 0).toLocaleString('he-IL')}`);
  }

  if (healthScore) {
    lines.push('', `ציון פיננסי: ${healthScore.score}/100 (${healthScore.level?.label || ''})`);
  }

  if (insights?.length) {
    lines.push('', 'תובנות פעילות:');
    insights.slice(0, 4).forEach(i => lines.push(`- ${i.title}: ${i.description}`));
  }

  if (investmentRecs) {
    lines.push('', `פרופיל סיכון: ${investmentRecs.riskLabel}`);
    lines.push(`המלצת השקעה חודשית: ₪${(investmentRecs.recommendedMonthlyInvestment || 0).toLocaleString('he-IL')}`);
  }

  const p = profile?.personal || {};
  if (p.age) lines.push('', `גיל: ${p.age}`);
  const goals = profile?.goals || [];
  if (goals.length) {
    lines.push('', 'יעדים פיננסיים:');
    goals.forEach(g => {
      const prog = g.targetAmount
        ? ` (${Math.round(((g.currentAmount || 0) / g.targetAmount) * 100)}%)`
        : '';
      lines.push(`- ${g.label || g.type}${prog} — יעד: ₪${(g.targetAmount || 0).toLocaleString('he-IL')}`);
    });
  }

  return lines.join('\n');
}

async function generateMonthlyReport({ profile, budgetAnalysis, investmentRecs, healthScore, insights, latestPayslip }) {
  const client = getClient();
  if (!client) {
    return { report: buildFallbackReport({ budgetAnalysis, healthScore, investmentRecs }), source: 'rule' };
  }

  const context = buildReportContext({ profile, budgetAnalysis, investmentRecs, healthScore, insights, latestPayslip });
  const systemPrompt = [
    'אתה יועץ פיננסי של FinGuide. כתוב דוח פיננסי חודשי אישי בעברית.',
    'הדוח צריך להיות: חם, מעודד, מקצועי ומועיל.',
    'מבנה הדוח (markdown):',
    '## סיכום חודשי',
    '## ניתוח הכנסות והוצאות',
    '## הישגים החודש',
    '## אתגרים ונקודות שיפור',
    '## המלצות לחודש הבא',
    '## תחזית לטווח ארוך',
    'היה ספציפי עם מספרים. שמור על טון חיובי אך כן.',
  ].join('\n');

  try {
    const response = await client.messages.create({
      model: REPORT_MODEL,
      max_tokens: 1200,
      temperature: 0.4,
      system: systemPrompt,
      messages: [{ role: 'user', content: `נתוני המשתמש:\n${context}\n\nאנא כתוב דוח פיננסי חודשי מקיף.` }],
    });

    const report = response.content
      ?.filter(b => b.type === 'text')
      .map(b => b.text)
      .join('')
      .trim();

    return {
      report,
      source: 'claude',
      generatedAt: new Date().toISOString(),
      tokensUsed: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0),
    };
  } catch (err) {
    console.error('[monthlyReport] Claude error', err.message);
    return { report: buildFallbackReport({ budgetAnalysis, healthScore, investmentRecs }), source: 'rule' };
  }
}

function buildFallbackReport({ budgetAnalysis, healthScore, investmentRecs }) {
  const lines = ['## סיכום חודשי', ''];
  if (healthScore) lines.push(`**ציון פיננסי:** ${healthScore.score}/100 — ${healthScore.level?.label || ''}`);
  if (budgetAnalysis?.available) {
    lines.push(`**מצב תקציב:** ${budgetAnalysis.health.label}`);
    lines.push(`**יחס חיסכון:** ${budgetAnalysis.savingsRate}`);
  }
  lines.push('', '## המלצות לחודש הבא', '');
  if (budgetAnalysis?.recommendations?.length) {
    budgetAnalysis.recommendations.slice(0, 3).forEach(r => {
      lines.push(`- **${r.title}:** ${r.description}`);
    });
  }
  if (investmentRecs) {
    lines.push(`- **השקעה מומלצת:** ₪${(investmentRecs.recommendedMonthlyInvestment || 0).toLocaleString('he-IL')} לחודש (פרופיל ${investmentRecs.riskLabel})`);
  }
  return lines.join('\n');
}

module.exports = { generateMonthlyReport };
