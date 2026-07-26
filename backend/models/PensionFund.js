

const mongoose = require('mongoose');

/**
 * PensionFund — stores user's pension fund data imported from Har HaKesef
 * or entered manually / extracted from uploaded documents.
 */
const pensionFundSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    fundName: {
      type: String,
      trim: true,
      maxlength: 200,
      required: true,
    },
    fundType: {
      type: String,
      enum: ['pension_comprehensive', 'pension_old', 'managers_insurance', 'provident_fund', 'study_fund', 'other'],
      default: 'pension_comprehensive',
    },
    provider: {
      type: String,
      trim: true,
      maxlength: 120,
      default: null,
    },
    accountNumber: {
      type: String,
      trim: true,
      maxlength: 60,
      default: null,
      select: false,
    },
    currentBalance: {
      type: Number,
      min: 0,
      default: null,
    },
    monthlyDeposit: {
      type: Number,
      min: 0,
      default: null,
    },
    monthlyEmployeeDeposit: {
      type: Number,
      min: 0,
      default: null,
    },
    monthlyEmployerDeposit: {
      type: Number,
      min: 0,
      default: null,
    },
    employeeContributionRate: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },
    employerContributionRate: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },
    managementFeeAccumulation: {
      type: Number,
      min: 0,
      max: 5,
      default: null,
    },
    managementFeeDeposit: {
      type: Number,
      min: 0,
      max: 5,
      default: null,
    },
    ytdReturn: {
      type: Number,
      default: null,
    },
    activityStatus: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE', 'UNKNOWN'],
      default: 'UNKNOWN',
    },
    insuranceCoverages: {
      type: [
        {
          coverageType: { type: String, default: null },
          monthlyPension: { type: Number, default: null },
          lumpSum: { type: Number, default: null },
        },
      ],
      default: [],
    },
    historicalReturn1Y: {
      type: Number,
      default: null,
    },
    historicalReturn5Y: {
      type: Number,
      default: null,
    },
    investmentTrack: {
      type: String,
      default: null,
    },
    riskLevel: {
      type: String,
      enum: ['high', 'medium', 'low', null],
      default: null,
    },
    status: {
      type: String,
      enum: ['active', 'closed'],
      default: 'active',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    source: {
      type: String,
      enum: ['manual', 'har_hakesef', 'quarterly_report', 'clearinghouse', 'free_report', 'user_excel'],
      default: 'manual',
    },
    sourceFile: {
      type: String,
      default: null,
    },
    rawData: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
      select: false,
    },
    lastUpdated: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'pension_funds',
  },
);

pensionFundSchema.index({ user: 1, isActive: 1 });
pensionFundSchema.index({ user: 1, source: 1 });

module.exports = mongoose.model('PensionFund', pensionFundSchema);
