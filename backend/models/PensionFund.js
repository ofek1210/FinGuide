'use strict';

const mongoose = require('mongoose');

/**
 * PensionFund — stores user's pension fund data imported from Har HaBituach
 * or extracted from uploaded documents.
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
    isActive: {
      type: Boolean,
      default: true,
    },
    sourceFile: {
      type: String,
      default: null,
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

module.exports = mongoose.model('PensionFund', pensionFundSchema);
