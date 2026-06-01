const mongoose = require('mongoose');

const NOTIFICATION_TYPES = [
  'insight_created',
  'recommendation_new',
  'document_processed',
  'salary_drop',
  'missing_payslip',
  'system',
];

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: NOTIFICATION_TYPES,
      required: true,
    },
    title: { type: String, required: true, trim: true },
    body: { type: String, default: '', trim: true },
    link: { type: String, default: null },
    read: { type: Boolean, default: false, index: true },
    readAt: { type: Date, default: null },
    sourceType: {
      type: String,
      enum: ['insight', 'recommendation', 'document', null],
      default: null,
    },
    sourceId: { type: mongoose.Schema.Types.ObjectId, default: null },
  },
  { timestamps: true },
);

notificationSchema.index({ user: 1, read: 1, createdAt: -1 });

notificationSchema.statics.NOTIFICATION_TYPES = NOTIFICATION_TYPES;

module.exports = mongoose.model('Notification', notificationSchema);
