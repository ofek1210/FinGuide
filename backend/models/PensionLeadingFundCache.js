'use strict';

const mongoose = require('mongoose');
const { RISK_LEVELS } = require('../config/pensionFinqConfig');

/**
 * Finq leading-funds cache — one document per risk cohort.
 * Collection is separate from user `pension_funds` (PensionFund model).
 */
const fundMetricSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    fundName: { type: String, default: '' },
    managingBody: { type: String, default: '' },
    yield3Years: { type: Number, default: null },
    managementFeeAccumulation: { type: Number, default: null },
    managementFeeDeposit: { type: Number, default: null },
    sharpeRatio: { type: Number, default: null },
    raw: { type: mongoose.Schema.Types.Mixed, select: false },
  },
  { _id: false },
);

const pensionLeadingFundCacheSchema = new mongoose.Schema(
  {
    riskCategory: {
      type: String,
      enum: RISK_LEVELS,
      required: true,
      unique: true,
      index: true,
    },
    funds: { type: [fundMetricSchema], default: [] },
    updatedAt: { type: Date, default: Date.now, index: true },
    finqFetchedAt: { type: Date, default: null },
    source: { type: String, enum: ['finq', 'cache_fallback'], default: 'finq' },
  },
  {
    collection: 'pension_leading_funds',
    timestamps: false,
  },
);

pensionLeadingFundCacheSchema.index({ riskCategory: 1, updatedAt: -1 });

module.exports = mongoose.model('PensionLeadingFundCache', pensionLeadingFundCacheSchema);
