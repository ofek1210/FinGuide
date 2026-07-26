const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: { type: String, default: 'שיחה', maxlength: 80 },
    lastSource: { type: String, default: null },
    degradedReason: { type: String, default: null },
    preview: { type: String, default: '', maxlength: 120 },
  },
  { timestamps: true },
);

conversationSchema.index({ user: 1, updatedAt: -1 });

// TTL: documents expire CHAT_RETENTION_DAYS after updatedAt (default 180).
const retentionDays = Number(process.env.CHAT_RETENTION_DAYS);
const days = Number.isFinite(retentionDays) && retentionDays > 0 ? retentionDays : 180;
conversationSchema.index(
  { updatedAt: 1 },
  { expireAfterSeconds: days * 24 * 60 * 60 },
);

module.exports = mongoose.model('Conversation', conversationSchema);
