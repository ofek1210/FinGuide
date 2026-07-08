

/**
 * Format unified summary health lines for email, WhatsApp, and reports.
 */
function formatDomainHealthLines(unified) {
  const lines = [];
  if (unified?.pension?.healthScore != null) {
    let line = `ציון בריאות פנסיונית: ${unified.pension.healthScore}/100`;
    if (unified.pension.totalPotentialSavings > 0) {
      line += ` · חיסכון פוטנציאלי: ₪${Math.round(unified.pension.totalPotentialSavings).toLocaleString('he-IL')}`;
    }
    lines.push(line);
  }
  if (unified?.insurance?.healthScore != null) {
    let line = `ציון בריאות ביטוח: ${unified.insurance.healthScore}/100`;
    if (unified.insurance.duplicateCount > 0) {
      line += ` · ${unified.insurance.duplicateCount} כפילויות`;
    }
    lines.push(line);
  }
  return lines;
}

function formatDomainHealthLinesHtml(unified) {
  return formatDomainHealthLines(unified).map(line =>
    `<p style="font-size:13px;color:#718096;margin:4px 0 0;">${line}</p>`,
  ).join('');
}

function formatDomainHealthLinesWhatsApp(unified) {
  const lines = [];
  if (unified?.pension?.healthScore != null) {
    lines.push(`📈 ציון בריאות פנסיונית: ${unified.pension.healthScore}/100`);
    if (unified.pension.totalPotentialSavings > 0) {
      lines.push(`💼 חיסכון פנסיוני עד פרישה: ₪${Math.round(unified.pension.totalPotentialSavings).toLocaleString('he-IL')}`);
    }
  }
  if (unified?.insurance?.healthScore != null) {
    lines.push(`🛡️ ציון בריאות ביטוח: ${unified.insurance.healthScore}/100`);
  }
  return lines;
}

module.exports = {
  formatDomainHealthLines,
  formatDomainHealthLinesHtml,
  formatDomainHealthLinesWhatsApp,
};
