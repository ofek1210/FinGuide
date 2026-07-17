

const mongoose = require('mongoose');

const pensionImportSnapshotSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    source: {
      type: String,
      enum: ['har_hakesef', 'quarterly_report', 'clearinghouse', 'free_report'],
      required: true,
    },
    sourceFile: { type: String, default: null },
    fileChecksumSha256: { type: String, default: null, index: true },
    importedAt: { type: Date, default: Date.now },
    fundCount: { type: Number, default: 0 },
    totalPotentialSavings: { type: Number, default: 0 },
    healthScore: { type: Number, default: null },
    avgRankPercentile: { type: Number, default: null },
    fundsAboveMarketFee: { type: Number, default: 0 },
  },
  { timestamps: true, collection: 'pension_import_snapshots' },
);

pensionImportSnapshotSchema.index({ user: 1, importedAt: -1 });

module.exports = mongoose.model('PensionImportSnapshot', pensionImportSnapshotSchema);
