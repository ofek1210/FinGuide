'use strict';

const mongoose = require('mongoose');

/**
 * AgentRunLog — tracks every multi-agent analysis run.
 * Used for debugging, performance monitoring, and auditing.
 */
const agentRunLogSchema = new mongoose.Schema(
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
    },
    agentsRan: {
      type: [String],
      default: [],
    },
    statuses: {
      type: Map,
      of: String,
      default: {},
    },
    totalRecommendations: {
      type: Number,
      default: 0,
    },
    durationMs: {
      type: Number,
      default: 0,
    },
    summarySource: {
      type: String,
      enum: ['claude', 'rule', 'fallback'],
      default: 'fallback',
    },
    errorCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    collection: 'agent_run_logs',
  },
);

// Auto-expire logs after 90 days
agentRunLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

module.exports = mongoose.model('AgentRunLog', agentRunLogSchema);
