const mongoose = require('mongoose');

const DocumentMetadataSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      enum: ['payslip', 'tax_report', 'pension_report', 'invoice', 'other'],
      default: 'other',
    },
    periodMonth: {
      type: Number,
      min: 1,
      max: 12,
    },
    periodYear: {
      type: Number,
      min: 2000,
      max: 2100,
    },
    documentDate: {
      type: Date,
    },
    source: {
      type: String,
      enum: ['manual_upload'],
      default: 'manual_upload',
    },
  },
  {
    _id: false,
  }
);

const DocumentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
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
    metadata: {
      type: DocumentMetadataSchema,
      default: () => ({
        category: 'other',
        source: 'manual_upload',
      }),
    },
    checksumSha256: {
      type: String,
    },
    status: {
      type: String,
      enum: ['uploaded', 'pending', 'processing', 'completed', 'failed'],
      default: 'uploaded',
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
    processingError: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// אינדקס לחיפוש מהיר לפי משתמש
DocumentSchema.index({ user: 1, uploadedAt: -1 });

module.exports = mongoose.model('Document', DocumentSchema);
