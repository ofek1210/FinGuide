/**
 * Unit tests for the local vector store (RAG layer).
 *
 * `fs` is fully mocked so the real data/vector_store.json is never read or
 * overwritten. Each test re-requires the module with a fresh in-memory cache.
 */

jest.mock('fs');
const fs = require('fs');

// In-memory backing for the mocked filesystem.
let fakeFiles;

function freshVectorStore(initial = null) {
  fakeFiles = {};
  if (initial) {
    // Pretend the store file already exists on disk.
    fakeFiles.__store = JSON.stringify(initial);
  }
  fs.existsSync.mockImplementation((p) => {
    if (typeof p === 'string' && p.endsWith('.json')) return fakeFiles.__store !== undefined;
    return true; // directories always "exist"
  });
  fs.mkdirSync.mockImplementation(() => undefined);
  fs.readFileSync.mockImplementation(() => fakeFiles.__store ?? '{"chunks":[]}');
  fs.writeFileSync.mockImplementation((_p, data) => {
    fakeFiles.__store = data;
  });

  let mod;
  jest.isolateModules(() => {
    // eslint-disable-next-line global-require
    mod = require('../../services/embeddings/vectorStore');
  });
  return mod;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('vectorStore.addChunk / getStats', () => {
  it('adds a chunk and reflects it in stats', () => {
    const vs = freshVectorStore();
    vs.addChunk('c1', 'hello', [1, 0, 0], { category: 'tax' });
    const stats = vs.getStats();
    expect(stats.totalChunks).toBe(1);
    expect(stats.categories.tax).toBe(1);
  });

  it('upserts: adding the same id twice keeps a single chunk', () => {
    const vs = freshVectorStore();
    vs.addChunk('c1', 'v1', [1, 0], { category: 'a' });
    vs.addChunk('c1', 'v2', [0, 1], { category: 'a' });
    expect(vs.getStats().totalChunks).toBe(1);
  });

  it('persists each change via writeFileSync', () => {
    const vs = freshVectorStore();
    vs.addChunk('c1', 'hello', [1, 0], {});
    expect(fs.writeFileSync).toHaveBeenCalled();
  });
});

describe('vectorStore.addChunks (batch upsert)', () => {
  it('adds many chunks and replaces duplicates by id', () => {
    const vs = freshVectorStore();
    vs.addChunk('dup', 'old', [1, 0], { category: 'x' });
    vs.addChunks([
      { id: 'dup', text: 'new', embedding: [0, 1], metadata: { category: 'x' } },
      { id: 'fresh', text: 'fresh', embedding: [1, 1], metadata: { category: 'y' } },
    ]);
    expect(vs.getStats().totalChunks).toBe(2);
  });
});

describe('vectorStore.search', () => {
  function seeded() {
    const vs = freshVectorStore();
    vs.addChunk('near', 'near text', [1, 0, 0], { category: 'tax' });
    vs.addChunk('mid', 'mid text', [0.7, 0.7, 0], { category: 'tax' });
    vs.addChunk('far', 'far text', [0, 0, 1], { category: 'pension' });
    return vs;
  }

  it('ranks results by descending cosine similarity', () => {
    const vs = seeded();
    const results = vs.search([1, 0, 0], { topK: 3, minScore: -1 });
    expect(results[0].id).toBe('near');
    expect(results[0].score).toBeGreaterThanOrEqual(results[1].score);
  });

  it('respects topK', () => {
    const vs = seeded();
    expect(vs.search([1, 0, 0], { topK: 1, minScore: -1 })).toHaveLength(1);
  });

  it('filters out results below minScore', () => {
    const vs = seeded();
    const results = vs.search([1, 0, 0], { topK: 10, minScore: 0.99 });
    expect(results.every((r) => r.score >= 0.99)).toBe(true);
    expect(results.map((r) => r.id)).toEqual(['near']);
  });

  it('filters by category metadata', () => {
    const vs = seeded();
    const results = vs.search([1, 0, 0], { topK: 10, minScore: -1, category: 'pension' });
    expect(results.map((r) => r.id)).toEqual(['far']);
  });
});

describe('vectorStore.clearStore / reload', () => {
  it('clearStore empties the store', () => {
    const vs = freshVectorStore();
    vs.addChunk('c1', 'x', [1], {});
    vs.clearStore();
    expect(vs.getStats().totalChunks).toBe(0);
  });

  it('reload reads persisted chunks back from disk', () => {
    const vs = freshVectorStore({
      chunks: [{ id: 'p1', text: 'persisted', embedding: [1, 0], metadata: { category: 'tax' } }],
    });
    expect(vs.reload().chunks).toHaveLength(1);
    expect(vs.getStats().categories.tax).toBe(1);
  });
});
