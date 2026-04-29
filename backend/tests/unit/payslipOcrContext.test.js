const fs = require('fs');
const path = require('path');

const {
  buildNormalizedOcrDocument,
  buildNormalizedOcrDocumentFromSource,
} = require('../../services/payslipOcrContext');

const readFixture = name =>
  fs.readFileSync(path.join(__dirname, '..', 'fixtures', name), 'utf8');

const readJsonFixture = name =>
  JSON.parse(readFixture(name));

describe('payslipOcrContext', () => {
  it('builds section hints and logical rows for text payslips', () => {
    const doc = buildNormalizedOcrDocument(readFixture('payslip-he-regression-row-shifted-table.txt'));

    expect(doc.sourceType).toBe('plain_text');
    expect(doc.sections.identity.length).toBeGreaterThan(0);
    expect(doc.sections.earnings.length).toBeGreaterThan(0);
    expect(doc.sections.tax_base.length).toBeGreaterThan(0);
    expect(doc.logicalRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          section: 'earnings',
        }),
      ]),
    );
  });

  it('adapts OCR JSON into the normalized document shape with layout metadata', () => {
    const doc = buildNormalizedOcrDocumentFromSource({
      ocrJson: readJsonFixture('payslip-ocr-json-sample.json'),
    });

    expect(doc.sourceType).toBe('ocr_json');
    expect(doc.layoutAvailable).toBe(true);
    expect(doc.lines[0]).toEqual(
      expect.objectContaining({
        confidence: expect.any(Number),
        bbox: expect.any(Object),
      }),
    );
    expect(doc.sections.identity.length).toBeGreaterThan(0);
  });
});
