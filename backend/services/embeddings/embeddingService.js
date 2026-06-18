/**
 * Embedding Service — generates vector embeddings from text.
 *
 * Architecture decision: We use Ollama's `all-minilm` model (already available
 * on the institutional server) for embedding generation. This keeps everything
 * self-contained without adding external paid services (Pinecone, OpenAI embeddings).
 *
 * For vector storage we use a local JSON-based store (vectorStore.js) which is
 * sufficient for a demo with <1000 chunks. In production this would be replaced
 * with MongoDB Atlas Vector Search or a dedicated vector DB.
 */

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'all-minilm';

/**
 * Generate an embedding vector for a given text.
 * @param {string} text - The text to embed
 * @returns {Promise<number[]|null>} - The embedding vector or null on failure
 */
async function generateEmbedding(text) {
  if (!text || typeof text !== 'string') return null;

  // Truncate to model's max input (~512 tokens ≈ ~2000 chars for safety)
  const truncated = text.slice(0, 2000);

  try {
    const resp = await fetch(`${OLLAMA_URL}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: EMBEDDING_MODEL, prompt: truncated }),
    });

    if (!resp.ok) return null;
    const data = await resp.json();
    return data.embedding || null;
  } catch {
    return null;
  }
}

/**
 * Generate embeddings for multiple texts in batch.
 * @param {string[]} texts
 * @returns {Promise<(number[]|null)[]>}
 */
async function generateEmbeddings(texts) {
  const results = [];
  for (const text of texts) {
    const embedding = await generateEmbedding(text);
    results.push(embedding);
  }
  return results;
}

/**
 * Compute cosine similarity between two vectors.
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number} similarity score between -1 and 1
 */
function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

module.exports = { generateEmbedding, generateEmbeddings, cosineSimilarity };
