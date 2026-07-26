'use strict';

const { buildGemelAnalysis } = require('../gemelAnalysisService');

const GEMEL_LLM_PROMPT = `You are an Israeli financial advisor explaining gemel and study fund analysis in Hebrew.
Rules:
- Simple, friendly Hebrew — no jargon
- Do NOT invent fees, returns or fund names
- Preserve numbers exactly as given
- Explain risk and that past returns don't guarantee future results
- Never say "guaranteed", "best fund", or "you should definitely switch"
- Use: "כדאי לבדוק", "עשוי להתאים", "ניתן להשוות"
- Return plain Hebrew text only (3-6 sentences)`;

async function polishGemelReportSummary(report, { skipLLM = false } = {}) {
  const fallback = buildFallbackSummary(report);
  if (skipLLM || !process.env.ANTHROPIC_API_KEY) {
    return { summary: fallback, llm: { used: false } };
  }

  try {
    const { askClaude } = require('../claudeChatService');
    const context = {
      accountCount: report.summary?.accountCount,
      totalBalance: report.summary?.totalBalance,
      topFindings: report.recommendations?.slice(0, 3).map(r => r.title),
      missing: report.dataQuality?.warnings,
    };
    const result = await askClaude(
      `הקשר:\n${JSON.stringify(context, null, 2)}\n\nכתוב סיכום קצר בעברית.`,
      GEMEL_LLM_PROMPT,
      [],
    );
    if (result?.answer?.trim()) {
      return { summary: result.answer.trim(), llm: { used: true, provider: 'claude' } };
    }
  } catch {
    // fallback
  }
  return { summary: fallback, llm: { used: false, fallbackUsed: true } };
}

function buildFallbackSummary(report) {
  const n = report.summary?.accountCount || 0;
  const bal = report.summary?.totalBalance || 0;
  if (!n) return 'לא נמצאו חשבונות גמל או השתלמות.';
  const top = report.recommendations?.[0]?.title;
  let s = `נמצאו ${n} חשבונות עם צבירה כוללת של כ-₪${Math.round(bal).toLocaleString('he-IL')}.`;
  if (report.dataQuality?.unmatchedAccounts) {
    s += ` ${report.dataQuality.unmatchedAccounts} חשבונות דורשים התאמה ידנית לנתוני שוק.`;
  }
  if (top) s += ` נושא מרכזי לבדיקה: ${top}.`;
  s += ' תשואות עבר אינן מבטיחות תשואות עתידיות.';
  return s;
}

module.exports = { polishGemelReportSummary, buildFallbackSummary, GEMEL_LLM_PROMPT };
