const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ['user', 'assistant', 'system'],
      required: true,
    },
    content: { type: String, required: true, maxlength: 8000 },
    metadata: {
      intent: { type: String, default: null },
      source: { type: String, default: null },
      contextUsed: { type: [String], default: [] },
      tokensUsed: { type: Number, default: null },
      model: { type: String, default: null },
      degradedReason: { type: String, default: null },
      title: { type: String, default: null },
      feedbackRating: { type: Number, default: null },
      feedbackNote: { type: String, default: null },
      feedbackAt: { type: Date, default: null },
      latencyMs: { type: Number, default: null },
    },
  },
  { timestamps: true },
);

chatMessageSchema.index({ user: 1, conversationId: 1, createdAt: 1 });

module.exports = mongoose.model('ChatMessage', chatMessageSchema);
