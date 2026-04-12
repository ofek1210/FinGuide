const fs = require('fs');
const path = require('path');

const { buildNormalizedOcrDocument } = require('../../services/payslipOcrContext');
const {
  collectPartyCandidates,
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
});
