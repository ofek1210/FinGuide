

const mongoose = require('mongoose');

const insuranceImportSnapshotSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    sourceFile: { type: String, default: null },
    importedAt: { type: Date, default: Date.now },
    policyCount: { type: Number, default: 0 },
    duplicateCount: { type: Number, default: 0 },
    totalMonthlyWaste: { type: Number, default: 0 },
    healthScore: { type: Number, default: null },
    annualSavings: { type: Number, default: 0 },
  },
  { timestamps: true, collection: 'insurance_import_snapshots' },
);

insuranceImportSnapshotSchema.index({ user: 1, importedAt: -1 });

module.exports = mongoose.model('InsuranceImportSnapshot', insuranceImportSnapshotSchema);
