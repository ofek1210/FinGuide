/**
 * RAG Service — Retrieval-Augmented Generation pipeline.
 *
 * Flow:
 * 1. User asks a question
 * 2. Generate embedding for the question
 * 3. Search vector store for relevant chunks (knowledge base + user documents)
 * 4. Inject retrieved context into the agent's prompt
 * 5. Agent generates grounded answer
 *
 * This service ties together: embeddingService + vectorStore + documentChunker + knowledgeBase
 */

const { generateEmbedding, generateEmbeddings } = require('./embeddingService');
const vectorStore = require('./vectorStore');
const { chunkPayslipAnalysis, chunkKnowledgeArticle } = require('./documentChunker');
const { knowledgeArticles } = require('./knowledgeBase');

/**
 * Initialize the knowledge base by embedding all articles and storing in vector store.
 * Call this once at startup or when knowledge base changes.
 * @returns {Promise<{indexed: number, failed: number}>}
 */
async function indexKnowledgeBase() {
  let indexed = 0;
  let failed = 0;

  for (const article of knowledgeArticles) {
    const chunks = chunkKnowledgeArticle(article.content, {
      title: article.title,
      category: article.category,
      source: article.source,
    });

    for (const chunk of chunks) {
      const embedding = await generateEmbedding(chunk.text);
      if (embedding) {
        vectorStore.addChunk(chunk.id, chunk.text, embedding, chunk.metadata);
        indexed++;
      } else {
        failed++;
      }
    }
  }

  return { indexed, failed };
}

/**
 * Index a user's payslip document into the vector store.
 * Called after successful OCR processing.
 * @param {object} document - The MongoDB document with analysisData
 * @returns {Promise<{indexed: number}>}
 */
async function indexPayslipDocument(document) {
  if (!document?.analysisData?.summary) return { indexed: 0 };

  const chunks = chunkPayslipAnalysis(document.analysisData, {
    documentId: document._id?.toString() || 'unknown',
    date: document.analysisData.summary.date,
  });

  let indexed = 0;
  for (const chunk of chunks) {
    const embedding = await generateEmbedding(chunk.text);
    if (embedding) {
      vectorStore.addChunk(chunk.id, chunk.text, embedding, {
        ...chunk.metadata,
        userId: document.user?.toString(),
      });
      indexed++;
    }
  }

  return { indexed };
}

/**
 * Retrieve relevant context for a user query.
 * Searches both knowledge base and user documents.
 * @param {string} query - The user's question
 * @param {object} options
 * @param {string} options.userId - Filter user-specific documents
 * @param {string} options.category - Filter by knowledge category
 * @param {number} options.topK - Number of results (default: 5)
 * @returns {Promise<{context: string, sources: Array}>}
 */
async function retrieveContext(query, options = {}) {
  const { userId, category, topK = 5 } = options;

  const queryEmbedding = await generateEmbedding(query);
  if (!queryEmbedding) {
    return { context: '', sources: [] };
  }

  // Search knowledge base
  const kbResults = vectorStore.search(queryEmbedding, {
    topK: Math.ceil(topK * 0.6), // 60% from knowledge base
    minScore: 0.3,
    category: category || null,
  });

  // Search user documents (if userId provided)
  let userResults = [];
  if (userId) {
    const allResults = vectorStore.search(queryEmbedding, {
      topK: Math.ceil(topK * 0.4), // 40% from user docs
      minScore: 0.25,
    });
    userResults = allResults.filter(r => r.metadata?.userId === userId);
  }

  const allResults = [...kbResults, ...userResults]
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  // Build context string for prompt injection
  const contextParts = allResults.map(r => {
    const source = r.metadata?.title || r.metadata?.source || 'מאגר ידע';
    return `[מקור: ${source} | רלוונטיות: ${(r.score * 100).toFixed(0)}%]\n${r.text}`;
  });

  return {
    context: contextParts.join('\n\n---\n\n'),
    sources: allResults.map(r => ({
      id: r.id,
      score: r.score,
      category: r.metadata?.category,
      source: r.metadata?.source,
      title: r.metadata?.title,
    })),
  };
}

/**
 * Get vector store statistics.
 */
function getRAGStats() {
  return vectorStore.getStats();
}

/**
 * Check if knowledge base is indexed.
 */
function isKnowledgeBaseIndexed() {
  const stats = vectorStore.getStats();
  return stats.totalChunks > 0;
}

module.exports = {
  indexKnowledgeBase,
  indexPayslipDocument,
  retrieveContext,
  getRAGStats,
  isKnowledgeBaseIndexed,
};
