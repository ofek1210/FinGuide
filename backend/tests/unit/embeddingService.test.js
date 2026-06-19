/**
 * Unit tests for the embedding service (RAG layer).
 * cosineSimilarity is pure; generateEmbedding(s) hit Ollama via fetch — mocked here.
 */

const {
  generateEmbedding,
  generateEmbeddings,
  cosineSimilarity,
} = require('../../services/embeddings/embeddingService');

describe('embeddingService.cosineSimilarity', () => {
  it('returns 1 for identical vectors', () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 6);
  });

  it('returns 0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 6);
  });

  it('returns -1 for opposite vectors', () => {
    expect(cosineSimilarity([1, 1], [-1, -1])).toBeCloseTo(-1, 6);
  });

  it('returns 0 when lengths mismatch', () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2])).toBe(0);
  });

  it('returns 0 for null/undefined input', () => {
    expect(cosineSimilarity(null, [1, 2])).toBe(0);
    expect(cosineSimilarity([1, 2], undefined)).toBe(0);
  });

  it('returns 0 when a vector is all zeros (zero denominator)', () => {
    expect(cosineSimilarity([0, 0], [1, 2])).toBe(0);
  });
});

describe('embeddingService.generateEmbedding', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it('returns null for empty/non-string input without calling fetch', async () => {
    global.fetch = jest.fn();
    expect(await generateEmbedding('')).toBeNull();
    expect(await generateEmbedding(null)).toBeNull();
    expect(await generateEmbedding(42)).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns the embedding vector on a successful response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ embedding: [0.1, 0.2, 0.3] }),
    });
    const result = await generateEmbedding('שלום עולם');
    expect(result).toEqual([0.1, 0.2, 0.3]);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('truncates very long text to ~2000 chars before sending', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ embedding: [1] }),
    });
    await generateEmbedding('x'.repeat(5000));
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.prompt.length).toBe(2000);
  });

  it('returns null when the HTTP response is not ok', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, json: async () => ({}) });
    expect(await generateEmbedding('text')).toBeNull();
  });

  it('returns null when fetch throws (network error)', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    expect(await generateEmbedding('text')).toBeNull();
  });

  it('returns null when response has no embedding field', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    expect(await generateEmbedding('text')).toBeNull();
  });
});

describe('embeddingService.generateEmbeddings (batch)', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('returns one result per input, preserving order and nulls', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ embedding: [1] }) })
      .mockResolvedValueOnce({ ok: false, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ embedding: [3] }) });

    const results = await generateEmbeddings(['a', 'b', 'c']);
    expect(results).toEqual([[1], null, [3]]);
  });
});
