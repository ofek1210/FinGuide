'use strict';

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const Document = require('../models/Document');
const Insight = require('../models/Insight');
const Notification = require('../models/Notification');

const unlink = promisify(fs.unlink);

async function removeStoredFile(filePath) {
  if (!filePath) return;
  try {
    const uploadsDir = path.resolve(process.cwd(), 'uploads');
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(uploadsDir)) {
      return;
    }
    await unlink(resolved);
  } catch (err) {
    if (err?.code !== 'ENOENT') {
      console.error('שגיאה במחיקת קובץ מסמך:', err);
    }
  }
}

function removeVectorChunksForDocument(documentId) {
  try {
    const { removeChunksByDocumentId } = require('./embeddings/vectorStore');
    removeChunksByDocumentId(documentId);
  } catch (err) {
    console.warn('[documentPurge] vector cleanup skipped:', err.message);
  }
}

function clearAiUserContext(userId) {
  try {
    const { clearUserContextCache } = require('../controllers/aiController');
    if (typeof clearUserContextCache === 'function') {
      clearUserContextCache(userId);
    }
  } catch (err) {
    console.warn('[documentPurge] AI cache clear skipped:', err.message);
  }
}

function scheduleInsightsRefresh(userId) {
  setImmediate(() => {
    const { runFullAnalysis } = require('./insightsEngine');
    const { run: runRecommendations } = require('./insuranceRecommender');
    runFullAnalysis(userId)
      .then(() => runRecommendations(userId))
      .catch(err => console.error('[documentPurge] post-delete analysis failed', err));
  });
}

/**
 * Fully remove one or more documents for a user: DB row, PDF file, insights,
 * notifications, RAG chunks, and AI context cache. Then refresh insights.
 *
 * @param {string|import('mongoose').Types.ObjectId} userId
 * @param {Array<object>} documents - Document mongoose docs or lean objects
 * @returns {Promise<{ deletedCount: number, documentIds: string[] }>}
 */
async function purgeUserDocuments(userId, documents = []) {
  const list = (documents || []).filter(Boolean);
  if (!userId || !list.length) {
    return { deletedCount: 0, documentIds: [] };
  }

  const documentIds = list.map(doc => doc._id);
  const idStrings = documentIds.map(id => String(id));

  await Promise.all(list.map(doc => removeStoredFile(doc.filePath)));

  const deleteResult = await Document.deleteMany({
    _id: { $in: documentIds },
    user: userId,
  });

  await Insight.deleteMany({
    user: userId,
    sourceDocumentIds: { $in: documentIds },
  });

  const notificationFilter = {
    user: userId,
    $or: [{ sourceType: 'document', sourceId: { $in: documentIds } }],
  };
  if (idStrings.length === 1) {
    notificationFilter.$or.push({ link: new RegExp(idStrings[0], 'i') });
  } else if (idStrings.length > 1) {
    const escaped = idStrings.map(id => id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    notificationFilter.$or.push({ link: { $regex: escaped.join('|'), $options: 'i' } });
  }
  await Notification.deleteMany(notificationFilter);

  for (const id of idStrings) {
    removeVectorChunksForDocument(id);
  }

  clearAiUserContext(userId);
  scheduleInsightsRefresh(userId);

  return {
    deletedCount: deleteResult.deletedCount || 0,
    documentIds: idStrings,
  };
}

async function purgeUserDocumentById(userId, documentId) {
  const document = await Document.findOne({ _id: documentId, user: userId });
  if (!document) {
    return null;
  }
  await purgeUserDocuments(userId, [document]);
  return document;
}

async function purgeAllUserDocuments(userId) {
  const documents = await Document.find({ user: userId });
  return purgeUserDocuments(userId, documents);
}

module.exports = {
  purgeUserDocuments,
  purgeUserDocumentById,
  purgeAllUserDocuments,
};
