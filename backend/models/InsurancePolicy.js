'use strict';

const mongoose = require('mongoose');

/**
 * InsurancePolicy — stores user insurance policies imported from Har HaBituach Excel
 * or entered manually.
 */
const insurancePolicySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['life', 'health', 'disability', 'apartment', 'car', 'mortgage', 'critical_illness', 'other'],
      required: true,
    },
    provider: {
      type: String,
      trim: true,
      maxlength: 120,
      default: null,
    },
    policyNumber: {
      type: String,
      trim: true,
      maxlength: 60,
      default: null,
    },
    monthlyPremium: {
      type: Number,
      min: 0,
      default: null,
    },
    annualPremium: {
      type: Number,
      min: 0,
      default: null,
    },
    coverageAmount: {
      type: Number,
      min: 0,
      default: null,
    },
    startDate: {
      type: Date,
      default: null,
    },
    endDate: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ['active', 'expired', 'cancelled', 'unknown'],
      default: 'active',
    },
    sourceFile: {
      type: String,
      default: null,
    },
    rawData: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
      select: false, // Never expose raw import data
    },
    notes: {
      type: String,
      maxlength: 500,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'insurance_policies',
  },
);

insurancePolicySchema.index({ user: 1, type: 1 });
insurancePolicySchema.index({ user: 1, status: 1 });

module.exports = mongoose.model('InsurancePolicy', insurancePolicySchema);
