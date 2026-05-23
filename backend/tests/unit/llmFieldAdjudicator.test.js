const {
  adjudicateField,
  shouldAdjudicate,
  clearCache,
  ADJUDICATE_THRESHOLDS,
  _setAnthropicClientForTests,
  _internal: { buildCacheKey, buildContextSnippet, buildPrompt },
} = require('../../services/llmFieldAdjudicator');

const candidate = (value, score = 0.7, extras = {}) => ({
  value,
  score,
  source: 'label_same_line',
  lineIndex: 10,
  ...extras,
});

const stubClient = ({ chosenIndex = 0, confidence = 0.92, reason = 'ok' } = {}) => ({
  messages: {
    create: jest.fn().mockResolvedValue({
      content: [{
        type: 'text',
        text: JSON.stringify({
          chosen_candidate_index: chosenIndex,
          confidence,
          reason,
        }),
      }],
    }),
  },
});

const ORIGINAL_KEY = process.env.ANTHROPIC_API_KEY;

beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = 'sk-test-key';
  clearCache();
  _setAnthropicClientForTests(null);
});

afterAll(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = ORIGINAL_KEY;
});

describe('shouldAdjudicate', () => {
  const c1 = candidate(100, 0.6);
  const c2 = candidate(200, 0.5);

  it('returns false with fewer than 2 candidates', () => {
    expect(shouldAdjudicate({ candidates: [c1], bestCandidate: c1, hasViolation: false })).toBe(false);
  });

  it('returns true when best confidence is below threshold', () => {
    expect(shouldAdjudicate({ candidates: [c1, c2], bestCandidate: c1, hasViolation: false })).toBe(true);
  });

  it('returns true when there is a reconciler violation, even at high confidence', () => {
    const high = candidate(100, 0.95);
    expect(shouldAdjudicate({ candidates: [high, c2], bestCandidate: high, hasViolation: true })).toBe(true);
  });

  it('returns false when best confidence is high and no violation', () => {
    const high = candidate(100, 0.95);
    expect(shouldAdjudicate({ candidates: [high, c2], bestCandidate: high, hasViolation: false })).toBe(false);
  });

  it('returns true when top two candidates are within close-tie delta', () => {
    const a = candidate(100, 0.82);
    const b = candidate(200, 0.80);
    expect(shouldAdjudicate({ candidates: [a, b], bestCandidate: a, hasViolation: false })).toBe(true);
  });
});

describe('adjudicateField — happy path', () => {
  it('returns the chosen candidate index from Claude', async () => {
    const client = stubClient({ chosenIndex: 1, confidence: 0.94, reason: 'matches mandatory_total label' });
    _setAnthropicClientForTests(client);

    const result = await adjudicateField({
      field: 'mandatory_total',
      candidates: [candidate(265, 0.6), candidate(173.88, 0.55)],
      rawLines: ['some context', 'ניכויי חובה', '173.88'],
      currentResolutions: { gross_total: 4072.05 },
    });

    expect(result).toMatchObject({ chosenIndex: 1, confidence: 0.94, source: 'llm_haiku' });
    expect(client.messages.create).toHaveBeenCalledTimes(1);
    const call = client.messages.create.mock.calls[0][0];
    expect(call.model).toBe('claude-haiku-4-5');
    expect(call.output_config.format.type).toBe('json_schema');
  });

  it('caches identical requests', async () => {
    const client = stubClient({ chosenIndex: 0 });
    _setAnthropicClientForTests(client);

    const args = {
      field: 'national_insurance',
      candidates: [candidate(42.35, 0.6), candidate(173.88, 0.55)],
      rawLines: ['x', 'y'],
      currentResolutions: {},
    };
    const first = await adjudicateField(args);
    const second = await adjudicateField(args);

    expect(first.source).toBe('llm_haiku');
    expect(second.source).toBe('cache');
    expect(client.messages.create).toHaveBeenCalledTimes(1);
  });
});

describe('adjudicateField — error and edge cases', () => {
  it('returns null with no API key', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    _setAnthropicClientForTests(null);

    const result = await adjudicateField({
      field: 'gross_total',
      candidates: [candidate(100)],
      rawLines: [],
    });
    expect(result).toBeNull();
  });

  it('returns null when chosen_candidate_index is out of range', async () => {
    _setAnthropicClientForTests(stubClient({ chosenIndex: 99 }));
    const result = await adjudicateField({
      field: 'gross_total',
      candidates: [candidate(100), candidate(200)],
      rawLines: [],
    });
    expect(result).toBeNull();
  });

  it('returns null when the model replies with non-JSON text', async () => {
    _setAnthropicClientForTests({
      messages: { create: jest.fn().mockResolvedValue({ content: [{ type: 'text', text: 'not json' }] }) },
    });
    const result = await adjudicateField({
      field: 'gross_total',
      candidates: [candidate(100), candidate(200)],
      rawLines: [],
    });
    expect(result).toBeNull();
  });

  it('returns null and does not throw when the API call rejects', async () => {
    _setAnthropicClientForTests({
      messages: { create: jest.fn().mockRejectedValue(new Error('boom')) },
    });
    const result = await adjudicateField({
      field: 'gross_total',
      candidates: [candidate(100), candidate(200)],
      rawLines: [],
    });
    expect(result).toBeNull();
  });

  it('honors a null chosen_candidate_index (model abstains)', async () => {
    _setAnthropicClientForTests(stubClient({ chosenIndex: null, confidence: 0.4, reason: 'none match' }));
    const result = await adjudicateField({
      field: 'gross_total',
      candidates: [candidate(100), candidate(200)],
      rawLines: [],
    });
    expect(result).toMatchObject({ chosenIndex: null, confidence: 0.4 });
  });
});

describe('internal helpers', () => {
  it('buildCacheKey is stable for identical input and changes when input changes', () => {
    const baseArgs = {
      field: 'gross_total',
      candidates: [candidate(100, 0.5), candidate(200, 0.5)],
      snippet: 'L0: hello',
    };
    const k1 = buildCacheKey(baseArgs);
    const k2 = buildCacheKey(baseArgs);
    expect(k1).toBe(k2);
    const k3 = buildCacheKey({ ...baseArgs, field: 'net_payable' });
    expect(k3).not.toBe(k1);
  });

  it('buildContextSnippet windows lines around candidate.lineIndex', () => {
    const rawLines = Array.from({ length: 20 }, (_, i) => `line ${i}`);
    const snippet = buildContextSnippet({
      rawLines,
      candidates: [candidate(100, 0.5, { lineIndex: 10 })],
    });
    expect(snippet).toContain('L10: line 10');
    expect(snippet).toContain('L4: line 4');
    expect(snippet).not.toContain('L18: line 18');
  });

  it('buildPrompt mentions the field, candidates, and an Israeli payroll context', () => {
    const prompt = buildPrompt({
      field: 'national_insurance',
      candidates: [candidate(42.35, 0.6), candidate(9, 0.5)],
      snippet: 'L10: ביטוח לאומי',
      currentResolutions: { gross_total: 4000 },
    });
    expect(prompt).toMatch(/national_insurance/);
    expect(prompt).toMatch(/Israeli payroll/);
    expect(prompt).toMatch(/\[0\] value=42.35/);
    expect(prompt).toMatch(/\[1\] value=9/);
    expect(prompt).toMatch(/gross_total = 4000/);
  });

  it('exports thresholds for callers and tests', () => {
    expect(ADJUDICATE_THRESHOLDS.lowConfidence).toBeGreaterThan(0);
    expect(ADJUDICATE_THRESHOLDS.skipIfConfidenceAbove).toBeGreaterThan(ADJUDICATE_THRESHOLDS.lowConfidence);
  });
});
