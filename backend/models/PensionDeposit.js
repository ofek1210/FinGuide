

const mongoose = require('mongoose');

/** Historical pension contributions — linked to PensionFund via accountNumber / fund ref. */
const pensionDepositSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    fund: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PensionFund',
      default: null,
      index: true,
    },
    accountNumber: {
      type: String,
      trim: true,
      maxlength: 60,
      default: null,
    },
    valueDate: { type: String, default: null },
    salaryMonth: { type: String, default: null },
    employerName: { type: String, trim: true, maxlength: 200, default: null },
    employeeDeposit: { type: Number, min: 0, default: 0 },
    employerDeposit: { type: Number, min: 0, default: 0 },
    severanceDeposit: { type: Number, min: 0, default: 0 },
    source: {
      type: String,
      enum: ['clearinghouse', 'manual'],
      default: 'clearinghouse',
    },
    sourceFile: { type: String, default: null },
  },
  { timestamps: true, collection: 'pension_deposits' },
);

pensionDepositSchema.index({ user: 1, accountNumber: 1, salaryMonth: 1 });

module.exports = mongoose.model('PensionDeposit', pensionDepositSchema);
