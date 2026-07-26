'use strict';

const mongoose = require('mongoose');

const gemelAdvisorReportSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    runId: { type: String, required: true, unique: true, index: true },
    report: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  { timestamps: true, collection: 'gemel_advisor_reports' },
);

gemelAdvisorReportSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 7 });

module.exports = mongoose.model('GemelAdvisorReport', gemelAdvisorReportSchema);
