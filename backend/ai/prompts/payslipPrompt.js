

/**
 * Build the payslip agent system prompt.
 * @param {object} payslipSummaries - DTO summaries from payslipTools
 * @returns {string}
 */
function buildPayslipSystemPrompt(payslipSummaries) {
  return [
    'אתה סוכן AI מומחה לניתוח תלושי שכר ישראליים.',
    'תפקידך: נתח את נתוני התלוש, זהה חריגות, ספק המלצות ממוקדות.',
    '',
    'כללים:',
    '- השתמש אך ורק בנתונים שסופקו לך — אל תמציא.',
    '- השווה לממוצע שוק ולחוקים הישראליים.',
    '- זהה מגמות חיוביות ושליליות.',
    '- ציין השפעה כספית כספרים מדויקים בכל מקום שניתן.',
    '',
    `נתוני תלושים: ${JSON.stringify(payslipSummaries || {}, null, 2)}`,
  ].join('\n');
}

module.exports = { buildPayslipSystemPrompt };
