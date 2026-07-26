'use strict';

const { sanitizeForPdf, visualHebrewLine, formatImpactStars } = require('../../services/pdf/pdfTextUtils');

const NBSP = String.fromCharCode(0x00a0);

describe('pdfTextUtils', () => {
  it('replaces unsupported currency and symbol glyphs', () => {
    expect(sanitizeForPdf('הפסד ~₪5,595')).toBe('הפסד ~ש"ח 5,595');
    expect(sanitizeForPdf('★★★☆☆')).toBe('');
    expect(sanitizeForPdf('• פריט')).toBe('- פריט');
  });

  it('strips bidi control characters', () => {
    expect(sanitizeForPdf('\u200Fשלום\u200E')).toBe('שלום');
  });

  describe('visualHebrewLine', () => {
    it('joins words with NBSP so PDFKit treats the line as one RTL chunk', () => {
      const out = visualHebrewLine('ציון בריאות');
      expect(out).toBe(`ציון${NBSP}בריאות`);
      expect(out).not.toContain(' ');
    });

    it('pre-reverses digit runs so the whole-line flip restores them', () => {
      // fontkit reverses the full line at render time, so runs must be
      // stored reversed for "78/100" to appear correctly in the PDF.
      expect(visualHebrewLine('ציון 78/100')).toBe(`ציון${NBSP}001/87`);
      expect(visualHebrewLine('כ-150 בחודש')).toBe(`כ-051${NBSP}בחודש`);
    });

    it('keeps multi-segment Latin runs as one unit', () => {
      expect(visualHebrewLine('מדד S&P 500 עולה')).toBe(`מדד${NBSP}005${NBSP}P&S${NBSP}עולה`);
    });

    it('does not swallow trailing sentence punctuation into LTR runs', () => {
      expect(visualHebrewLine('בשנת 2026.')).toBe(`בשנת${NBSP}6202.`);
    });

    it('swaps bracket pairs so they mirror correctly after the flip', () => {
      expect(visualHebrewLine('(טוב)')).toBe(')טוב(');
    });
  });

  it('formatImpactStars uses plain text not unicode stars', () => {
    expect(formatImpactStars(4)).toBe('השפעה: 4/5');
    expect(formatImpactStars(0)).toBe('השפעה: 0/5');
  });
});
