const {
  extractTaxCreditPointsFromText,
  readTaxCreditPoints,
} = require('../../utils/taxCreditPoints');

describe('taxCreditPoints', () => {
  it('extracts credit points from "סך נקודות זיכוי" malam-style text', () => {
    const text = 'סך נקודות זיכוי\nאחוז מס שולי\n2.25\n10%';
    expect(extractTaxCreditPointsFromText(text)).toBe(2.25);
  });

  it('extracts from "מספר נקודות זיכוי" label', () => {
    const text = 'מספר נקודות זיכוי 2.25';
    expect(extractTaxCreditPointsFromText(text)).toBe(2.25);
  });

  it('reads from tax object, summary, then OCR text fallback', () => {
    expect(readTaxCreditPoints({ tax: { tax_credit_points: 2.75 } })).toBe(2.75);
    expect(readTaxCreditPoints({ summary: { taxCreditPoints: 3 } })).toBe(3);
    expect(readTaxCreditPoints({}, 'נקודות זיכוי: 2.25')).toBe(2.25);
  });
});
