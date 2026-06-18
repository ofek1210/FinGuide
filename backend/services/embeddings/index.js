/**
 * Embeddings module — public API.
 */

const embeddingService = require('./embeddingService');
const vectorStore = require('./vectorStore');
const documentChunker = require('./documentChunker');
const ragService = require('./ragService');

module.exports = {
  ...embeddingService,
  ...vectorStore,
  ...documentChunker,
  ...ragService,
};
