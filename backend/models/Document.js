const mongoose = require('mongoose');

const DocumentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    originalName: {
      type: String,
      required: true,
    },
    filename: {
      type: String,
      required: true,
      unique: true,
    },
    filePath: {
      type: String,
      required: true,
    },
    fileSize: {
      type: Number,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
    processedAt: {
      type: Date,
    },
    analysisData: {
      type: Object,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// אינדקס לחיפוש מהיר לפי משתמש
DocumentSchema.index({ user: 1, uploadedAt: -1 });

module.exports = mongoose.model('Document', DocumentSchema);
