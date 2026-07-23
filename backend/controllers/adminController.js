const User = require('../models/User');
const Document = require('../models/Document');
const Conversation = require('../models/Conversation');
const ChatMessage = require('../models/ChatMessage');
const LlmUserBudget = require('../models/LlmUserBudget');

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * ספירה יומית לפי createdAt עבור 30 הימים האחרונים
 * @param {import('mongoose').Model} Model
 * @param {Date} since
 * @returns {Promise<Array<{ date: string, count: number }>>}
 */
const countByDay = async (Model, since) => {
  const rows = await Model.aggregate([
    { $match: { createdAt: { $gte: since } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);
  return rows.map(r => ({ date: r._id, count: r.count }));
};

/**
 * @route   GET /api/admin/stats
 * @desc    מדדי מערכת למנהלים — משתמשים, מסמכים, שימוש ב-AI
 * @access  Private + Admin
 */
const getAdminStats = async (req, res) => {
  const now = Date.now();
  const since30d = new Date(now - 30 * DAY_MS);
  const since7d = new Date(now - 7 * DAY_MS);

  const [
    totalUsers,
    onboardingCompleted,
    googleUsers,
    usersByDay,
    documentsByStatus,
    uploadsByDay,
    totalConversations,
    totalMessages,
    messagesBySource,
    tokenTotals,
    activeChatUserIds,
    activeUploadUserIds,
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ 'onboarding.completed': true }),
    User.countDocuments({ googleId: { $ne: null } }),
    countByDay(User, since30d),
    Document.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    countByDay(Document, since30d),
    Conversation.countDocuments(),
    ChatMessage.countDocuments(),
    ChatMessage.aggregate([
      { $match: { role: 'assistant', source: { $ne: null } } },
      { $group: { _id: '$source', count: { $sum: 1 } } },
    ]),
    LlmUserBudget.aggregate([
      {
        $group: {
          _id: null,
          tokens: { $sum: '$tokens' },
          calls: { $sum: '$calls' },
        },
      },
    ]),
    ChatMessage.distinct('user', { createdAt: { $gte: since7d } }),
    Document.distinct('user', { createdAt: { $gte: since7d } }),
  ]);

  const byStatus = {};
  documentsByStatus.forEach(r => {
    byStatus[r._id || 'unknown'] = r.count;
  });
  const completed = byStatus.completed || 0;
  const failed = byStatus.failed || 0;
  const ocrAttempts = completed + failed;

  const bySource = {};
  messagesBySource.forEach(r => {
    bySource[r._id] = r.count;
  });

  // משתמשים פעילים = צ'אט או העלאת מסמך ב-7 הימים האחרונים
  const activeUserIds = new Set([
    ...activeChatUserIds.map(String),
    ...activeUploadUserIds.map(String),
  ]);

  res.json({
    success: true,
    data: {
      users: {
        total: totalUsers,
        onboardingCompleted,
        onboardingRate: totalUsers ? onboardingCompleted / totalUsers : 0,
        googleUsers,
        newByDay: usersByDay,
        activeLast7d: activeUserIds.size,
      },
      documents: {
        total: Object.values(byStatus).reduce((a, b) => a + b, 0),
        byStatus,
        uploadsByDay,
        ocrSuccessRate: ocrAttempts ? completed / ocrAttempts : null,
      },
      ai: {
        conversations: totalConversations,
        messages: totalMessages,
        bySource,
        totalTokens: tokenTotals[0]?.tokens || 0,
        totalCalls: tokenTotals[0]?.calls || 0,
      },
      generatedAt: new Date().toISOString(),
    },
  });
};

module.exports = { getAdminStats };
