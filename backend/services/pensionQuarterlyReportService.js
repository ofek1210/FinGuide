/**
 * Parser for quarterly pension reports (דוח תקופתי) from Israeli providers.
 * FINQ recommends these as richer source than Har HaKesef alone.
 */



const { parseHarHaKesefText } = require('./harHaKesefService');

const PROVIDER_PATTERNS = [
  { pattern: /מגדל/i, provider: 'מגדל' },
  { pattern: /הראל|harel/i, provider: 'הראל' },
  { pattern: /כלל/i, provider: 'כלל' },
  { pattern: /מנורה/i, provider: 'מנורה' },
  { pattern: /מיטב|altshuler/i, provider: 'מיטב דש' },
  { pattern: /פסגות/i, provider: 'פסגות' },
  { pattern: /פenix|פניקס/i, provider: 'פenix' },
];

function detectProvider(text) {
  for (const { pattern, provider } of PROVIDER_PATTERNS) {
    if (pattern.test(text)) return provider;
  }
  return null;
}

/**
 * Parse quarterly report text (from pdftotext or pasted content).
 * Reuses Har HaKesef table parser when layout matches; enriches with provider detection.
 */
function parseQuarterlyReportText(text, originalName = '') {
  const provider = detectProvider(text) || detectProvider(originalName);
  const base = parseHarHaKesefText(text);

  if (base.funds.length === 0) {
    const migdalBox = text.match(/תיבה\s*[אא][:\s]*([^\n]+)/i);
    const balanceMatch = text.match(/(?:יתרה|צבירה|סה"כ)[:\s]*₪?\s*([\d,]+)/i);
    const feeMatch = text.match(/דמי ניהול[^0-9]*([\d.]+)\s*%/i);
    const trackLine = text.match(/מסלול[^:\n]*[:]\s*([^\n]+)/i);
    const trackName = migdalBox ? migdalBox[1].trim() : (trackLine ? trackLine[1].trim() : null);

    if (balanceMatch) {
      const balance = parseFloat(balanceMatch[1].replace(/,/g, ''));
      base.funds.push({
        fundName: provider ? `${provider} — דוח תקופתי` : 'קרן פנסיה',
        fundType: 'pension_comprehensive',
        provider,
        currentBalance: balance,
        managementFeeAccumulation: feeMatch ? parseFloat(feeMatch[1]) / 100 : null,
        investmentTrack: trackName,
        isActive: true,
        status: 'active',
        rawData: { source: 'quarterly_fallback' },
      });
    }
  }

  const funds = base.funds.map(f => ({
    ...f,
    provider: f.provider || provider,
    source: 'quarterly_report',
  }));

  return {
    source: 'quarterly_report',
    exportDate: base.exportDate,
    funds,
    summary: {
      ...base.summary,
      totalFunds: funds.length,
      provider,
      parseWarnings: funds.length
        ? base.summary.parseWarnings
        : [...(base.summary.parseWarnings || []), 'לא זוהו קרנות — ודא שזה דוח תקופתי מלא'],
    },
  };
}

module.exports = { parseQuarterlyReportText, detectProvider };
