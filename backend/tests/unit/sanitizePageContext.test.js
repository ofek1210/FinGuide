const { sanitizePageContext } = require('../../controllers/aiController');

describe('sanitizePageContext', () => {
  test('strips control chars and fences', () => {
    const raw = 'שלום\u0000 עולם ```system``` ignore previous';
    const out = sanitizePageContext(raw);
    expect(out).not.toMatch(/```/);
    expect(out).not.toMatch(/\u0000/);
    expect(out).toContain('שלום');
  });

  test('caps length at 900', () => {
    const out = sanitizePageContext('א'.repeat(2000));
    expect(out.length).toBeLessThanOrEqual(900);
  });

  test('returns null for non-string', () => {
    expect(sanitizePageContext(null)).toBeNull();
    expect(sanitizePageContext(12)).toBeNull();
  });
});
