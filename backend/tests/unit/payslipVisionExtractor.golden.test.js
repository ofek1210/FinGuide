const fs = require('fs');
const path = require('path');
const { extractPayslipFromImage } = require('../../services/payslipVisionExtractor');
const { applySanityAndSummary } = require('../../services/payslipVisionPipeline');

const GOLDEN_ROOT = path.join(__dirname, '../../services/__fixtures__/golden');
const VISION_FIXTURE_PREFIX = 'vision-';

function listVisionFixtures() {
  if (!fs.existsSync(GOLDEN_ROOT)) return [];
  return fs.readdirSync(GOLDEN_ROOT)
    .filter(name => name.startsWith(VISION_FIXTURE_PREFIX))
    .map(name => {
      const dir = path.join(GOLDEN_ROOT, name);
      const inputPng = path.join(dir, 'input.png');
      const expectedJson = path.join(dir, 'expected.json');
      if (!fs.existsSync(inputPng) || !fs.existsSync(expectedJson)) {
        return null;
      }
      return { name, inputPng, expectedJson };
    })
    .filter(Boolean);
}

function numClose(actual, expected, tolerance = Math.max(0.01, Math.abs(expected) * 0.005)) {
  if (actual === undefined && expected === undefined) return true;
  if (!Number.isFinite(actual) || !Number.isFinite(expected)) return false;
  return Math.abs(actual - expected) <= tolerance;
}

function expectFieldClose(actual, expected, label) {
  if (expected === undefined || expected === null) return;
  expect(numClose(actual, expected)).toBe(true);
}

const fixtures = listVisionFixtures();

describe('payslipVisionExtractor golden fixtures', () => {
  const ORIGINAL_KEY = process.env.ANTHROPIC_API_KEY;
  const hasApiKey = Boolean(process.env.ANTHROPIC_API_KEY);

  afterAll(() => {
    if (ORIGINAL_KEY === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = ORIGINAL_KEY;
  });

  fixtures.forEach(fixture => {
    const expected = JSON.parse(fs.readFileSync(fixture.expectedJson, 'utf8'));

    it(`fixture ${fixture.name} has input.png and expected.json`, () => {
      expect(fs.existsSync(fixture.inputPng)).toBe(true);
      expect(expected.schema_version).toBe('1.9');
      expect(expected.contributions?.pension?.employee).toBeDefined();
      expect(expected.contributions?.pension?.employer).toBeDefined();
    });

    (hasApiKey ? it : it.skip)(`extracts ${fixture.name} via vision API`, async () => {
      const buffer = fs.readFileSync(fixture.inputPng);
      const { normalized } = await extractPayslipFromImage(buffer, { mimeType: 'image/png' });
      const data = applySanityAndSummary({ ...normalized });

      if (expected.period?.month) {
        const norm = String(data.period?.month || '').replace(/^(\d{4})-(\d{1,2})$/, '$2/$1');
        const exp = String(expected.period.month);
        expect(norm === exp || data.period?.month === exp).toBe(true);
      }

      expectFieldClose(data.salary?.gross_total, expected.salary?.gross_total, 'gross');
      expectFieldClose(data.salary?.net_payable, expected.salary?.net_payable, 'net');
      expectFieldClose(data.deductions?.mandatory?.total, expected.deductions?.mandatory?.total, 'mandatory');

      expectFieldClose(
        data.contributions?.pension?.employee,
        expected.contributions?.pension?.employee,
        'pension employee',
      );
      expectFieldClose(
        data.contributions?.pension?.employer,
        expected.contributions?.pension?.employer,
        'pension employer',
      );
      expectFieldClose(
        data.contributions?.pension?.participation_total,
        expected.contributions?.pension?.participation_total,
        'pension total',
      );

      if (expected.contributions?.study_fund) {
        expectFieldClose(
          data.contributions?.study_fund?.employee,
          expected.contributions?.study_fund?.employee,
          'study employee',
        );
        expectFieldClose(
          data.contributions?.study_fund?.employer,
          expected.contributions?.study_fund?.employer,
          'study employer',
        );
      }

      if (expected.parties?.employer_name) {
        expect(data.parties?.employer_name).toContain('צה');
      }
    }, 120000);
  });
});

if (!fixtures.length) {
  it('vision golden fixtures pending', () => {
    expect(fixtures.length).toBeGreaterThan(0);
  });
}
