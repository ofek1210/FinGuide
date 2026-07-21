'use strict';

const { sanitizeForPdf, rtl, formatImpactStars } = require('../../services/pdf/pdfTextUtils');

describe('pdfTextUtils', () => {
  it('replaces unsupported currency and symbol glyphs', () => {
    expect(sanitizeForPdf('הפסד ~₪5,595')).toBe('הפסד ~ש"ח 5,595');
    expect(sanitizeForPdf('★★★☆☆')).toBe('');
    expect(sanitizeForPdf('• פריט')).toBe('- פריט');
  });

  it('rtl reverses Hebrew tokens while keeping numbers readable', () => {
    const visual = rtl('ציון הבריאות הפיננסית שלך הוא 27/100');
    expect(visual).toContain('27/100');
    expect(visual).toMatch(/[\u0590-\u05FF]/);
  });

  it('formatImpactStars uses plain text not unicode stars', () => {
    expect(formatImpactStars(4)).toBe('השפעה: 4/5');
    expect(formatImpactStars(0)).toBe('השפעה: 0/5');
  });
});
