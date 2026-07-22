'use strict';

const path = require('path');

/**
 * Shared PDF text helpers for PDFKit + Heebo (vendored in assets/fonts).
 *
 * PDFKit has no bidi algorithm. Its embedded-font layer splits text into
 * word chunks at ASCII spaces and fontkit reverses the glyphs of each
 * RTL-script chunk independently. The net effect for logical Hebrew input:
 * every word renders correctly but word order stays left-to-right and
 * inter-word spaces collapse onto word edges.
 *
 * The fix (drawRtlText):
 *  1. Wrap lines manually (so line order is ours, not PDFKit's).
 *  2. Join each line's words with NBSP — PDFKit only splits on space/tab,
 *     so the whole line becomes a single chunk and fontkit reverses it as
 *     one unit, which is exactly a correct visual-RTL flip.
 *  3. Pre-reverse LTR runs (digits/Latin) and swap bracket pairs so the
 *     whole-line flip restores them to correct LTR appearance.
 */

const HEBREW_RE = /[\u0590-\u05FF]/;
const FONTS_DIR = path.join(__dirname, '../../assets/fonts');

const HEBREW_FONTS = {
  regular: path.join(FONTS_DIR, 'Heebo-Regular.ttf'),
  bold: path.join(FONTS_DIR, 'Heebo-Bold.ttf'),
};

/** Register the vendored Hebrew fonts on a PDFKit document. */
function registerHebrewFonts(doc) {
  doc.registerFont('Hebrew', HEBREW_FONTS.regular);
  doc.registerFont('Hebrew-Bold', HEBREW_FONTS.bold);
}

/** Strip/replace glyphs that Heebo can't render or that break the flip. */
function sanitizeForPdf(text) {
  return String(text ?? '')
    .replace(/₪/g, 'ש"ח ')
    .replace(/[★☆⭐✨]/g, '')
    .replace(/[•‣●○◦·]/g, '- ')
    .replace(/[–—]/g, '-')
    .replace(/[\u200F\u200E\u202A-\u202E\u2066-\u2069]/g, '')
    .replace(/[\u{1F300}-\u{1FAFF}]/gu, '')
    .replace(/⚖\s*/g, 'הערה: ')
    .replace(/\s+/g, ' ')
    .trim();
}

const MIRROR_PAIRS = { '(': ')', ')': '(', '[': ']', ']': '[', '{': '}', '}': '{' };
// An LTR run starts and ends on alphanumeric (or %), and may contain
// number/word punctuation and single spaces between segments (e.g. "S&P 500").
const LTR_RUN_RE = /[A-Za-z0-9%][A-Za-z0-9.,:/&+\- ]*[A-Za-z0-9%]|[A-Za-z0-9]/g;

/**
 * Convert one logical-order line (no newlines) into the string that renders
 * as correct visual RTL once fontkit flips the whole line. Exported for tests.
 */
function visualHebrewLine(line) {
  return line
    .replace(/[()[\]{}]/g, ch => MIRROR_PAIRS[ch])
    .replace(LTR_RUN_RE, run => [...run].reverse().join(''))
    .replace(/ /g, '\u00A0');
}

/**
 * Render Hebrew (or mixed) text on a PDFKit doc with correct RTL layout,
 * wrapping into lines that fit the current content width. Caller sets
 * font/size/color; opts (lineGap, width, ...) pass through to doc.text.
 */
function drawRtlText(doc, text, opts = {}) {
  const s = sanitizeForPdf(text);
  if (!s) return;
  if (!HEBREW_RE.test(s)) {
    doc.text(s, { align: 'right', ...opts });
    return;
  }
  const maxWidth = opts.width ?? (doc.page.width - doc.page.margins.right - doc.x);
  const lines = [];
  let current = '';
  for (const word of s.split(' ')) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && doc.widthOfString(visualHebrewLine(candidate)) > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  for (const line of lines) {
    doc.text(visualHebrewLine(line), { align: 'right', ...opts, width: maxWidth });
  }
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
  HEBREW_FONTS,
  registerHebrewFonts,
  sanitizeForPdf,
  visualHebrewLine,
  drawRtlText,
  formatImpactStars,
  pdfContainsHebrew,
};
