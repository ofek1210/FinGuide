const mongoose = require('mongoose');

const INSIGHT_KINDS = [
  'salary_drop',
  'salary_growth',
  'pension_low',
  'pension_missing',
  'tax_anomaly',
  'missing_payslip',
  'unusual_deduction',
  'study_fund_low',
];

const INSIGHT_SEVERITIES = ['info', 'warning', 'critical'];
const INSIGHT_STATUSES = ['active', 'dismissed', 'resolved'];

const insightSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    kind: {
      type: String,
      enum: INSIGHT_KINDS,
      required: true,
    },
    severity: {
      type: String,
      enum: INSIGHT_SEVERITIES,
      default: 'info',
    },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
    status: {
      type: String,
      enum: INSIGHT_STATUSES,
      default: 'active',
      index: true,
    },
    dismissedAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
    sourceDocumentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Document' }],
  },
  { timestamps: true },
);

insightSchema.index({ user: 1, kind: 1, status: 1 });

insightSchema.statics.INSIGHT_KINDS = INSIGHT_KINDS;
insightSchema.statics.INSIGHT_SEVERITIES = INSIGHT_SEVERITIES;

module.exports = mongoose.model('Insight', insightSchema);
