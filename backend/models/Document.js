const mongoose = require('mongoose');

const DocumentMetadataSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      enum: ['payslip', 'tax_report', 'form_106', 'pension_report', 'invoice', 'other'],
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
      enum: ['manual_upload', 'gmail'],
      default: 'manual_upload',
    },
  },
  {
    _id: false,
  }
);

const EmailMetadataSchema = new mongoose.Schema(
  {
    subject: { type: String, default: null },
    from: { type: String, default: null },
    date: { type: Date, default: null },
    gmailMessageId: { type: String, default: null },
    gmailAttachmentId: { type: String, default: null },
  },
  { _id: false }
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
      enum: ['uploaded', 'pending', 'processing', 'completed', 'needs_review', 'failed'],
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
    source: {
      type: String,
      enum: ['manual', 'gmail'],
      default: 'manual',
      index: true,
    },
    emailMetadata: {
      type: EmailMetadataSchema,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

DocumentSchema.index({ user: 1, uploadedAt: -1 });
DocumentSchema.index(
  {
    user: 1,
    'emailMetadata.gmailMessageId': 1,
    'emailMetadata.gmailAttachmentId': 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      'emailMetadata.gmailMessageId': { $type: 'string' },
      'emailMetadata.gmailAttachmentId': { $type: 'string' },
    },
  }
);

module.exports = mongoose.model('Document', DocumentSchema);
