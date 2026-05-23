const mongoose = require('mongoose');

const RECOMMENDATION_KINDS = [
  'life',
  'health',
  'disability',
  'apartment',
  'car',
  'pension_increase',
];

const IMPORTANCE_LEVELS = ['critical', 'high', 'medium', 'low'];
const RECOMMENDATION_STATUSES = ['active', 'dismissed', 'purchased'];

const recommendationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    kind: {
      type: String,
      enum: RECOMMENDATION_KINDS,
      required: true,
    },
    importance: {
      type: String,
      enum: IMPORTANCE_LEVELS,
      default: 'medium',
    },
    title: { type: String, required: true, trim: true },
    reasoning: { type: [String], default: [] },
    priceRange: {
      min: { type: Number, default: 0 },
      average: { type: Number, default: 0 },
      max: { type: Number, default: 0 },
      currency: { type: String, default: 'ILS' },
    },
    coverageEstimate: { type: Number, default: null },
    status: {
      type: String,
      enum: RECOMMENDATION_STATUSES,
      default: 'active',
      index: true,
    },
    lastEvaluatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

recommendationSchema.index({ user: 1, kind: 1, status: 1 });

recommendationSchema.statics.RECOMMENDATION_KINDS = RECOMMENDATION_KINDS;
recommendationSchema.statics.IMPORTANCE_LEVELS = IMPORTANCE_LEVELS;

module.exports = mongoose.model('Recommendation', recommendationSchema);
