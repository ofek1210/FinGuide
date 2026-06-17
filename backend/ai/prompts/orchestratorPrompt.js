/**
 * Orchestrator prompt — guides the LLM to merge multi-agent results
 * into a coherent Hebrew summary with prioritized action items.
 */

'use strict';

/**
 * Build the orchestrator system prompt.
 * Receives merged agent results (DTOs only — no raw DB objects).
 *
 * @param {object} agentResults
 * @param {object} [agentResults.payslip]
 * @param {object} [agentResults.insurance]
 * @param {object} [agentResults.pension]
 * @param {object} [agentResults.profile]
 * @returns {string}
 */
function buildOrchestratorSystemPrompt(agentResults) {
  const lines = [
    'אתה מנהל AI פיננסי בכיר של FinGuide.',
    'קיבלת תוצאות מארבעה סוכני AI שעבדו במקביל:',
    '  1. סוכן תלושים (payslipAgent)',
    '  2. סוכן ביטוח (insuranceAgent)',
    '  3. סוכן פנסיה (pensionAgent)',
    '  4. סוכן פרופיל פיננסי (financialProfileAgent)',
    '',
    'תפקידך:',
    '- מזג את התוצאות לסיכום פיננסי מקיף ותמציתי.',
    '- זהה סתירות בין סוכנים וסמן אותן.',
    '- תעדף המלצות לפי דחיפות ו-impact כספי.',
    '- כתוב בעברית ברורה, ממוקדת ומעשית.',
    '- אל תמציא מספרים שלא קיבלת מהסוכנים.',
    '',
    'פורמט תשובה:',
    '**סיכום מצב פיננסי** (2-3 משפטים)',
    '',
    '**פעולות דחופות**',
    '1. [כותרת] — [הסבר קצר] — [השפעה כספית אם קיימת]',
    '',
    '**המלצות לשיפור**',
    '- [המלצה] — [סיבה]',
    '',
    '**נקודות חוזק**',
    '- [מה טוב כרגע]',
  ];

  // Inject condensed agent results
  if (agentResults) {
    lines.push('', '─── תוצאות הסוכנים ───');
    if (agentResults.payslip) {
      lines.push('', `תלושים: ${JSON.stringify(agentResults.payslip, null, 2)}`);
    }
    if (agentResults.insurance) {
      lines.push('', `ביטוח: ${JSON.stringify(agentResults.insurance, null, 2)}`);
    }
    if (agentResults.pension) {
      lines.push('', `פנסיה: ${JSON.stringify(agentResults.pension, null, 2)}`);
    }
    if (agentResults.profile) {
      lines.push('', `פרופיל: ${JSON.stringify(agentResults.profile, null, 2)}`);
    }
  }

  return lines.join('\n');
}

module.exports = { buildOrchestratorSystemPrompt };
