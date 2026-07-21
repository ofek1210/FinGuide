'use strict';

/**
 * Shared PDF text helpers for PDFKit + Noto Sans Hebrew.
 * PDFKit has no native RTL/bidi — we reorder tokens for visual Hebrew.
 * Noto Sans Hebrew lacks many symbols (₪, ★, •) — replace before render.
 */

/** Strip/replace glyphs that render as tofu squares in Noto Sans Hebrew. */
function sanitizeForPdf(text) {
  return String(text ?? '')
    .replace(/\u20AA/g, 'ש"ח ')
    .replace(/[\u2605\u2606\u2B50\u2728]/g, '')
    .replace(/[\u2022\u2023\u25CF\u25CB\u25E6\u00B7]/g, '- ')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u200F\u200E\u202A-\u202E\u2066-\u2069]/g, '')
    .replace(/[\u{1F300}-\u{1FAFF}]/gu, '')
    .replace(/⚖\s*/g, 'הערה: ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Visual RTL for PDFKit — reverses token order, keeps digit/Latin runs readable.
 */
function rtl(text) {
  const s = sanitizeForPdf(text);
  if (!s) return s;
  if (!/[\u0590-\u05FF]/.test(s)) return s;

  const parts = s.match(
    /[\u0590-\u05FF]+(?:['"\u05F3\u05F4][\u0590-\u05FF]+)*|[A-Za-z][A-Za-z0-9._-]*|\d+(?:[.,]\d+)*(?:%|\/\d+)?|[^\s\u0590-\u05FFA-Za-z\d]+|\s+/g,
  );
  if (!parts?.length) return s;
  return parts.reverse().join('');
}

function formatImpactStars(n) {
  const count = Math.max(0, Math.min(5, Number(n) || 0));
  return `השפעה: ${count}/5`;
}

function pdfContainsHebrew(buffer) {
  const sample = buffer.toString('latin1');
  return /[\u0590-\u05FF]/.test(sample) || buffer.includes(Buffer.from('פנס', 'utf8'));
}

module.exports = {
  sanitizeForPdf,
  rtl,
  formatImpactStars,
  pdfContainsHebrew,
};
