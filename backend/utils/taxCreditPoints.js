'use strict';

function parseCreditPointsValue(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(String(value).replace(',', '.'));
  if (!Number.isFinite(n) || n < 0 || n > 30) return null;
  return Math.round(n * 100) / 100;
}

const TEXT_PATTERNS = [
  /(?:סך|מספר)\s*נקודות\s*זיכוי[:\s]*(\d+(?:[.,]\d+)?)/i,
  /(?:סך|מספר)\s*נקודות\s*זיכוי[\s\S]{0,80}?(\d+(?:[.,]\d+)?)/i,
  /נקודות\s*זיכוי[:\s]+(\d+(?:[.,]\d+)?)/i,
  /(\d+(?:[.,]\d+)?)\s*נקודות\s*זיכוי/i,
  /נ\.?\s*זיכוי[:\s]+(\d+(?:[.,]\d+)?)/i,
  /נק\.?\s*רגילות\s*(\d+(?:[.,]\d+)?)/i,
  /קוד\s*ב\.?\s*לאומי[^\n]*\n[\d,.]+\n(\d+(?:[.,]\d+)?)\n\d{2}\/\d{2}\/\d{4}/im,
];

function extractTaxCreditPointsFromText(text) {
  if (!text || typeof text !== 'string') return null;
  for (const regex of TEXT_PATTERNS) {
    const match = text.match(regex);
    if (!match?.[1]) continue;
    const parsed = parseCreditPointsValue(match[1]);
    if (parsed != null && parsed <= 20) return parsed;
  }
  return null;
}

/**
 * Resolve tax credit points from canonical analysisData paths + OCR text fallback.
 */
function readTaxCreditPoints(analysis, rawText = '') {
  if (!analysis || typeof analysis !== 'object') return null;

  const fromTax = parseCreditPointsValue(analysis.tax?.tax_credit_points);
  if (fromTax != null) return fromTax;

  const fromSummary = parseCreditPointsValue(analysis.summary?.taxCreditPoints);
  if (fromSummary != null) return fromSummary;

  const text = rawText
    || analysis.raw?.ocr_text
    || analysis.raw?.rawText
    || '';
  return extractTaxCreditPointsFromText(text);
}

module.exports = {
  parseCreditPointsValue,
  extractTaxCreditPointsFromText,
  readTaxCreditPoints,
};
