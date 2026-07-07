const fs = require('fs');
const path = require('path');

const { buildNormalizedOcrDocument } = require('../../services/payslipOcrContext');
const {
  applyEmployeeIdConsistencyBoost,
  collectPartyCandidates,
  isLikelyIsraeliId,
  resolvePartyCandidates,
} = require('../../services/payslipOcrParties');

const readFixture = name =>
  fs.readFileSync(path.join(__dirname, '..', 'fixtures', name), 'utf8');

describe('payslipOcrParties', () => {
  it('prefers explicit employee identity over employer/company identifiers', () => {
    const context = buildNormalizedOcrDocument(readFixture('payslip-he-regression-id-collision.txt'));
    const resolved = resolvePartyCandidates(collectPartyCandidates(context));

    expect(resolved.employee_name).toEqual(
      expect.objectContaining({
        value: 'יעל כהן',
        source: 'employee_name_label',
      }),
    );
    expect(resolved.employee_id).toEqual(
      expect.objectContaining({
        value: '987654321',
        source: 'employee_id_label',
      }),
    );
    expect(resolved.employer_name).toEqual(
      expect.objectContaining({
        value: 'חברת דוגמה בע"מ',
      }),
    );
  });

  it('ignores contribution-block identifiers when resolving employee identity', () => {
    const context = buildNormalizedOcrDocument(readFixture('payslip-he-regression-contribution-id-collision.txt'));
    const resolved = resolvePartyCandidates(collectPartyCandidates(context));

    expect(resolved.employee_name).toEqual(
      expect.objectContaining({
        value: 'גיל כהן',
        source: 'employee_name_label',
      }),
    );
    expect(resolved.employee_id).toEqual(
      expect.objectContaining({
        value: '123456780',
        source: 'employee_id_label',
      }),
    );
  });
});

describe('payslipOcrParties — isLikelyIsraeliId', () => {
  it('accepts valid 9-digit teudat-zehut by checksum', () => {
    expect(isLikelyIsraeliId('322819145')).toBe(true);
    expect(isLikelyIsraeliId('000000018')).toBe(true);
  });

  it('rejects ZIP codes (7 digits) and non-checksum numbers', () => {
    expect(isLikelyIsraeliId('7683941')).toBe(false);
    expect(isLikelyIsraeliId('123456789')).toBe(false);
    expect(isLikelyIsraeliId('')).toBe(false);
    expect(isLikelyIsraeliId(null)).toBe(false);
  });
});

describe('payslipOcrParties — applyEmployeeIdConsistencyBoost', () => {
  const candidate = (value, score) => ({ value, score });

  it('boosts duplicate ID values above the 0.4 resolution threshold', () => {
    const candidates = [
      candidate('322819145', 0.34),
      candidate('7683941', 0.34),
      candidate('322819145', 0.30),
      candidate('930484837', 0.30),
    ];
    applyEmployeeIdConsistencyBoost(candidates);
    const realId = candidates.find(c => c.value === '322819145' && c.score >= 0.5);
    const zip = candidates.find(c => c.value === '7683941');
    expect(realId).toBeDefined();
    expect(zip.score).toBeCloseTo(0.34, 2);
  });

  it('prefers a valid Israeli ID over a non-checksum 9-digit number on ties', () => {
    const candidates = [
      candidate('322819145', 0.34),
      candidate('322819145', 0.34),
      candidate('123456789', 0.34),
      candidate('123456789', 0.34),
    ];
    applyEmployeeIdConsistencyBoost(candidates);
    const valid = candidates.find(c => c.value === '322819145');
    const invalid = candidates.find(c => c.value === '123456789');
    expect(valid.score).toBeGreaterThan(invalid.score);
  });

  it('is a no-op for empty or single-candidate input', () => {
    expect(() => applyEmployeeIdConsistencyBoost([])).not.toThrow();
    expect(() => applyEmployeeIdConsistencyBoost(null)).not.toThrow();
    const single = [candidate('322819145', 0.3)];
    applyEmployeeIdConsistencyBoost(single);
    expect(single[0].score).toBe(0.3);
  });

  it('recognizes valid Israeli ID 205506975', () => {
    expect(isLikelyIsraeliId('205506975')).toBe(true);
  });
});

describe('payslipOcrParties — IDF header employer', () => {
  it('detects צבא הגנה לישראל from payslip header', () => {
    const context = buildNormalizedOcrDocument(readFixture('payslip-he-regression-idf-june.txt'));
    const resolved = resolvePartyCandidates(collectPartyCandidates(context));

    expect(resolved.employer_name).toEqual(
      expect.objectContaining({
        value: 'צבא הגנה לישראל',
        source: 'employer_header_pattern',
      }),
    );
    expect(resolved.employee_id).toEqual(
      expect.objectContaining({
        value: '205506975',
        source: 'employee_id_label',
      }),
    );
  });
});
