const mongoose = require('mongoose');

/**
 * Per-user Claude spend window (survives restart; isolates users).
 */
const llmUserBudgetSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    windowStart: { type: Date, required: true },
    calls: { type: Number, default: 0 },
    tokens: { type: Number, default: 0 },
  },
  { timestamps: true },
);

module.exports = mongoose.model('LlmUserBudget', llmUserBudgetSchema);
