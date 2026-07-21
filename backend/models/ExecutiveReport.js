'use strict';

const mongoose = require('mongoose');

/**
 * Cached executive report — PDF export reuses this payload by runId.
 */
const executiveReportSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    runId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    report: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
  },
  {
    timestamps: true,
    collection: 'executive_reports',
  },
);

executiveReportSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 7 });

module.exports = mongoose.model('ExecutiveReport', executiveReportSchema);
