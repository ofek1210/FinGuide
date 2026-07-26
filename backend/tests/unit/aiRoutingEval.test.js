/**
 * Regression gate for detectIntent — same fixtures as eval:ai-routing.
 */
const fs = require('fs');
const path = require('path');
const { detectIntent } = require('../../controllers/aiController');

const QUERIES_PATH = path.join(
  __dirname,
  '../../scripts/fixtures/ai-routing-eval/queries.json',
);

describe('AI intent routing eval fixtures', () => {
  const cases = JSON.parse(fs.readFileSync(QUERIES_PATH, 'utf8'));

  test('fixture file is non-empty', () => {
    expect(cases.length).toBeGreaterThanOrEqual(40);
  });

  test.each(cases.map((c) => [c.query, c.expectedIntent]))(
    'detectIntent(%j) → %s',
    (query, expectedIntent) => {
      expect(detectIntent(query)).toBe(expectedIntent);
    },
  );
});
