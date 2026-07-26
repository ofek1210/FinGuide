'use strict';

const { askClaude } = require('../../services/claudeChatService');

const EXECUTIVE_LLM_PROMPT = `You are a senior Israeli financial advisor writing an executive summary in Hebrew.
Rules:
- Write 5-8 simple, friendly sentences
- No jargon, no bullet points
- Describe overall financial health, main strength, main weakness, and what to do first
- Do NOT invent numbers — use only facts from the context
- Do NOT add new recommendations beyond the provided actions
- Return plain Hebrew text only`;

async function polishExecutiveSummary(report, { skipLLM = false } = {}) {
  if (skipLLM || !process.env.ANTHROPIC_API_KEY) {
    return { summary: report.sections.executiveSummary, llm: { used: false, provider: null } };
  }

  const agentReport = report.sections.agentReport || {};
  const context = {
    intro: agentReport.intro,
    analyzedDomains: (agentReport.agentSections || [])
      .filter(s => s.dataStatus === 'available')
      .map(s => s.title),
    topActions: (agentReport.agentSections || [])
      .flatMap(s => s.recommendations.map(r => r.title))
      .slice(0, 3),
    missingDomains: (agentReport.missingData || []).map(m => m.title),
  };

  try {
    const result = await askClaude(
      `הקשר:\n${JSON.stringify(context, null, 2)}\n\nכתוב סיכום מנהלים בעברית (5-8 משפטים).`,
      EXECUTIVE_LLM_PROMPT,
      [],
    );
    if (result?.answer?.trim()) {
      return { summary: result.answer.trim(), llm: { used: true, provider: 'claude' } };
    }
  } catch {
    // fallback
  }

  return { summary: report.sections.executiveSummary, llm: { used: false, provider: null, fallbackUsed: true } };
}

module.exports = { polishExecutiveSummary, EXECUTIVE_LLM_PROMPT };
