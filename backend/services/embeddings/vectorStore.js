/**
 * Vector Store — local file-based vector database.
 *
 * Why local JSON instead of a cloud vector DB?
 * - Zero infrastructure cost for a student project
 * - Works offline
 * - Good enough for <1000 chunks (our knowledge base)
 * - Easy to inspect/debug
 *
 * In production: replace with MongoDB Atlas Vector Search ($vectorSearch)
 * or Pinecone/Chroma for larger datasets.
 *
 * Data format:
 * {
 *   chunks: [
 *     { id, text, embedding, metadata: { source, category, ... } }
 *   ]
 * }
 */

const fs = require('fs');
const path = require('path');
const { cosineSimilarity } = require('./embeddingService');

const STORE_PATH = path.join(__dirname, '..', '..', 'data', 'vector_store.json');

// In-memory cache
let store = null;

function ensureDataDir() {
  const dir = path.dirname(STORE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function loadStore() {
  if (store) return store;
  ensureDataDir();
  if (fs.existsSync(STORE_PATH)) {
    const raw = fs.readFileSync(STORE_PATH, 'utf-8');
    store = JSON.parse(raw);
  } else {
    store = { chunks: [] };
  }
  return store;
}

function saveStore() {
  ensureDataDir();
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf-8');
}

/**
 * Add a chunk to the vector store.
 * @param {string} id - Unique chunk ID
 * @param {string} text - The text content
 * @param {number[]} embedding - The embedding vector
 * @param {object} metadata - Additional metadata (source, category, etc.)
 */
function addChunk(id, text, embedding, metadata = {}) {
  const s = loadStore();
  // Upsert: remove existing chunk with same ID
  s.chunks = s.chunks.filter(c => c.id !== id);
  s.chunks.push({ id, text, embedding, metadata });
  saveStore();
}

/**
 * Add multiple chunks at once.
 * @param {Array<{id: string, text: string, embedding: number[], metadata: object}>} chunks
 */
function addChunks(chunks) {
  const s = loadStore();
  const existingIds = new Set(chunks.map(c => c.id));
  s.chunks = s.chunks.filter(c => !existingIds.has(c.id));
  s.chunks.push(...chunks);
  saveStore();
}

/**
 * Search for the most similar chunks to a query embedding.
 * @param {number[]} queryEmbedding - The query vector
 * @param {object} options - Search options
 * @param {number} options.topK - Number of results to return (default: 5)
 * @param {number} options.minScore - Minimum similarity score (default: 0.3)
 * @param {string} options.category - Filter by metadata.category
 * @returns {Array<{id: string, text: string, score: number, metadata: object}>}
 */
function search(queryEmbedding, options = {}) {
  const { topK = 5, minScore = 0.3, category = null } = options;
  const s = loadStore();

  let candidates = s.chunks;
  if (category) {
    candidates = candidates.filter(c => c.metadata?.category === category);
  }

  const scored = candidates
    .map(chunk => ({
      id: chunk.id,
      text: chunk.text,
      score: cosineSimilarity(queryEmbedding, chunk.embedding),
      metadata: chunk.metadata,
    }))
    .filter(r => r.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return scored;
}

/**
 * Get stats about the vector store.
 */
function getStats() {
  const s = loadStore();
  const categories = {};
  s.chunks.forEach(c => {
    const cat = c.metadata?.category || 'unknown';
    categories[cat] = (categories[cat] || 0) + 1;
  });
  return { totalChunks: s.chunks.length, categories };
}

/**
 * Clear all chunks (useful for re-indexing).
 */
function clearStore() {
  store = { chunks: [] };
  saveStore();
}

/**
 * Reload store from disk (if modified externally).
 */
function reload() {
  store = null;
  return loadStore();
}

module.exports = { addChunk, addChunks, search, getStats, clearStore, reload };
