const { buildNormalizedOcrDocument } = require('../../services/payslipOcrContext');
const {
  collectPartyCandidates,
  isLikelyIsraeliId,
  normalizeEmployeeId,
  resolvePartyCandidates,
} = require('../../services/payslipOcrParties');
const {
  getMissingIdentityFields,
  mergeIdentityFromVision,
  needsIdentityVisionFallback,
} = require('../../services/payslipIdentityVisionFallback');

describe('normalizeEmployeeId', () => {
  it('strips dashes and spaces from Israeli IDs', () => {
    expect(normalizeEmployeeId('205-506-975')).toBe('205506975');
    expect(normalizeEmployeeId('205 506 975')).toBe('205506975');
    expect(normalizeEmployeeId('205506975')).toBe('205506975');
  });
});

describe('payslipOcrParties — dashed teudat zehut', () => {
  it('extracts name + dashed ID for Segev-style header', () => {
    const text = `
תלוש שכר לחודש 06/2026
שם עובד: שגב פרטוש
ת.ז. 205-506-975
שם מעסיק: חברת דוגמה בע"מ
ברוטו 20000
נטו 14000
`;
    const context = buildNormalizedOcrDocument(text);
    const resolved = resolvePartyCandidates(collectPartyCandidates(context));

    expect(resolved.employee_name).toEqual(
      expect.objectContaining({ value: 'שגב פרטוש' }),
    );
    expect(resolved.employee_id).toEqual(
      expect.objectContaining({ value: '205506975' }),
    );
    expect(isLikelyIsraeliId(resolved.employee_id.value)).toBe(true);
  });

  it('extracts ID near label when separators vary', () => {
    const text = 'תעודת זהות: 205506975\nשם העובד שגב פרטוש\n';
    const context = buildNormalizedOcrDocument(text);
    const resolved = resolvePartyCandidates(collectPartyCandidates(context));
    expect(resolved.employee_id.value).toBe('205506975');
  });
});

describe('payslipIdentityVisionFallback', () => {
  it('detects missing identity fields', () => {
    expect(needsIdentityVisionFallback({ parties: {}, period: {} })).toBe(true);
    expect(getMissingIdentityFields({
      parties: { employee_name: 'שגב', employee_id: '205506975' },
      period: { month: '2026-06' },
    })).toEqual([]);
  });

  it('merges only missing identity fields from vision', () => {
    const ocr = {
      parties: { employee_name: undefined, employee_id: undefined, employer_name: 'חברה' },
      period: {},
      quality: { warnings: [], fields: {} },
      raw: {},
    };
    const vision = {
      parties: {
        employee_name: 'שגב פרטוש',
        employee_id: '205-506-975',
        employer_name: 'ignored',
      },
      period: { month: '2026-06' },
      quality: { fields: {} },
    };

    const { filled } = mergeIdentityFromVision(ocr, vision);
    expect(filled).toEqual(expect.arrayContaining(['employee_name', 'employee_id', 'period_month']));
    expect(ocr.parties.employee_name).toBe('שגב פרטוש');
    expect(ocr.parties.employee_id).toBe('205506975');
    expect(ocr.parties.employer_name).toBe('חברה');
    expect(ocr.period.month).toBe('2026-06');
    expect(ocr.raw.identity_vision_fallback).toBe(true);
  });
});
