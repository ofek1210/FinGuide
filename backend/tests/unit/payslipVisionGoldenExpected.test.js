const fs = require('fs');
const path = require('path');
const { runPayslipSanityChecks } = require('../../services/payslipSanityChecks');

const FIXTURES = [
  'vision-idf-may-2026',
  'vision-idf-june-2026',
];

describe('vision golden expected.json internal consistency', () => {
  FIXTURES.forEach(name => {
    it(`${name} expected pension employee + employer = total`, () => {
      const expected = JSON.parse(fs.readFileSync(
        path.join(__dirname, '../../services/__fixtures__/golden', name, 'expected.json'),
        'utf8',
      ));
      const p = expected.contributions.pension;
      const sum = +(p.employee + p.employer).toFixed(2);
      expect(sum).toBeCloseTo(p.participation_total, 2);

      const sanity = runPayslipSanityChecks({
        schema_version: '1.9',
        salary: expected.salary,
        deductions: expected.deductions,
        contributions: expected.contributions,
      });
      expect(sanity.flaggedInconsistencies.filter(i => i.startsWith('pension'))).toHaveLength(0);
    });
  });
});
