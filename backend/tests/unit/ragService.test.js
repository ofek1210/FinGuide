/**
 * Unit tests for the RAG service — the retrieval pipeline that ties together
 * embeddings + vector store + chunker + knowledge base.
 *
 * embeddingService and vectorStore are mocked so tests are deterministic and
 * never hit Ollama or the real data file.
 */

jest.mock('../../services/embeddings/embeddingService');
jest.mock('../../services/embeddings/vectorStore');

const embeddingService = require('../../services/embeddings/embeddingService');
const vectorStore = require('../../services/embeddings/vectorStore');
const ragService = require('../../services/embeddings/ragService');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ragService.retrieveContext', () => {
  it('returns empty context when the query cannot be embedded', async () => {
    embeddingService.generateEmbedding.mockResolvedValue(null);
    const result = await ragService.retrieveContext('שאלה');
    expect(result).toEqual({ context: '', sources: [] });
    expect(vectorStore.search).not.toHaveBeenCalled();
  });

  it('merges knowledge-base and user-document hits and builds a context string', async () => {
    embeddingService.generateEmbedding.mockResolvedValue([1, 0, 0]);
    vectorStore.search
      // knowledge base search
      .mockReturnValueOnce([
        { id: 'kb1', text: 'חוק הפנסיה', score: 0.9, metadata: { title: 'פנסיה', category: 'pension' } },
      ])
      // user document search
      .mockReturnValueOnce([
        { id: 'u1', text: 'התלוש שלך', score: 0.8, metadata: { userId: 'user-1', category: 'income' } },
        { id: 'other', text: 'לא שלך', score: 0.95, metadata: { userId: 'user-2', category: 'income' } },
      ]);

    const result = await ragService.retrieveContext('שאלה', { userId: 'user-1', topK: 5 });

    // Only the current user's doc is kept from the user search.
    const ids = result.sources.map((s) => s.id);
    expect(ids).toContain('kb1');
    expect(ids).toContain('u1');
    expect(ids).not.toContain('other');

    // Context string includes relevance markers and the chunk text.
    expect(result.context).toContain('חוק הפנסיה');
    expect(result.context).toContain('רלוונטיות');
  });

  it('skips the user search entirely when no userId is given', async () => {
    embeddingService.generateEmbedding.mockResolvedValue([1, 0, 0]);
    vectorStore.search.mockReturnValueOnce([
      { id: 'kb1', text: 'מידע', score: 0.7, metadata: { category: 'tax' } },
    ]);

    await ragService.retrieveContext('שאלה', { topK: 3 });
    expect(vectorStore.search).toHaveBeenCalledTimes(1);
  });
});

describe('ragService.indexKnowledgeBase', () => {
  it('embeds and stores every chunk, reporting indexed count', async () => {
    embeddingService.generateEmbedding.mockResolvedValue([0.1, 0.2]);
    const { indexed, failed } = await ragService.indexKnowledgeBase();
    expect(indexed).toBeGreaterThan(0);
    expect(failed).toBe(0);
    expect(vectorStore.addChunk).toHaveBeenCalled();
  });

  it('counts chunks as failed when embedding returns null', async () => {
    embeddingService.generateEmbedding.mockResolvedValue(null);
    const { indexed, failed } = await ragService.indexKnowledgeBase();
    expect(indexed).toBe(0);
    expect(failed).toBeGreaterThan(0);
    expect(vectorStore.addChunk).not.toHaveBeenCalled();
  });
});

describe('ragService.indexPayslipDocument', () => {
  it('returns {indexed:0} for a document without analysisData.summary', async () => {
    expect(await ragService.indexPayslipDocument({})).toEqual({ indexed: 0 });
    expect(await ragService.indexPayslipDocument({ analysisData: {} })).toEqual({ indexed: 0 });
  });

  it('embeds payslip chunks and tags them with the userId', async () => {
    embeddingService.generateEmbedding.mockResolvedValue([1, 2, 3]);
    const document = {
      _id: { toString: () => 'doc-1' },
      user: { toString: () => 'user-9' },
      analysisData: { summary: { date: '2025-01', grossSalary: 20000, netSalary: 14000, tax: 2000 } },
    };

    const { indexed } = await ragService.indexPayslipDocument(document);
    expect(indexed).toBeGreaterThan(0);
    const lastCall = vectorStore.addChunk.mock.calls.at(-1);
    expect(lastCall[3].userId).toBe('user-9');
  });
});

describe('ragService stats helpers', () => {
  it('getRAGStats delegates to the vector store', () => {
    vectorStore.getStats.mockReturnValue({ totalChunks: 7, categories: {} });
    expect(ragService.getRAGStats()).toEqual({ totalChunks: 7, categories: {} });
  });

  it('isKnowledgeBaseIndexed reflects whether any chunks exist', () => {
    vectorStore.getStats.mockReturnValueOnce({ totalChunks: 0, categories: {} });
    expect(ragService.isKnowledgeBaseIndexed()).toBe(false);
    vectorStore.getStats.mockReturnValueOnce({ totalChunks: 3, categories: {} });
    expect(ragService.isKnowledgeBaseIndexed()).toBe(true);
  });
});
