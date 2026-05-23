const Notification = require('../models/Notification');

async function notify(userId, type, { title, body, link, sourceType, sourceId }) {
  return Notification.create({
    user: userId,
    type,
    title,
    body: body || '',
    link: link || null,
    sourceType: sourceType || null,
    sourceId: sourceId || null,
  });
}

async function notifyInsightCreated(userId, insight) {
  const typeMap = {
    salary_drop: 'salary_drop',
    missing_payslip: 'missing_payslip',
  };
  return notify(userId, typeMap[insight.kind] || 'insight_created', {
    title: insight.title,
    body: insight.description,
    link: '/insights',
    sourceType: 'insight',
    sourceId: insight._id,
  });
}

async function notifyRecommendationNew(userId, recommendation) {
  return notify(userId, 'recommendation_new', {
    title: `המלצה חדשה: ${recommendation.title}`,
    body: recommendation.reasoning?.[0] || '',
    link: '/insurance',
    sourceType: 'recommendation',
    sourceId: recommendation._id,
  });
}

async function notifyDocumentProcessed(userId, document) {
  const status = document.status;
  const title = status === 'completed' ? 'תלוש עובד בהצלחה' : 'תלוש דורש בדיקה';
  const body =
    status === 'completed'
      ? `המסמך "${document.originalName}" נותח בהצלחה.`
      : `המסמך "${document.originalName}" דורש בדיקה ידנית.`;
  return notify(userId, 'document_processed', {
    title,
    body,
    link: `/documents/${document._id}`,
    sourceType: 'document',
    sourceId: document._id,
  });
}

module.exports = {
  notify,
  notifyInsightCreated,
  notifyRecommendationNew,
  notifyDocumentProcessed,
};
