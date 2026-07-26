'use strict';

const mongoose = require('mongoose');

/**
 * Cohort-level annual returns from Gemel-Net UI
 * (tsuotHodPtihaRDL.xls — "סה\"כ נכסי הקופות לפי סוג קופה").
 */
const gemelNetCohortAnnualSchema = new mongoose.Schema(
  {
    source: {
      type: String,
      default: 'gemelnet_excel',
      enum: ['gemelnet_excel', 'data_gov_computed', 'cma_download'],
    },
    sourceFile: { type: String, default: null },
    reportLabel: { type: String, default: null },
    reportAsOf: { type: String, default: null },
    year: { type: Number, required: true, index: true },
    returnPctTotal: { type: Number, default: null },
    assetsTotalMillions: { type: Number, default: null },
    assetsTagmulimMillions: { type: Number, default: null },
    assetsHistalmutMillions: { type: Number, default: null },
    assetsMerkazitMillions: { type: Number, default: null },
    assetsInvestmentMillions: { type: Number, default: null },
    assetsChildSavingsMillions: { type: Number, default: null },
    assetsOtherGoalMillions: { type: Number, default: null },
    trailing12mReturnTotal: { type: Number, default: null },
    importedAt: { type: Date, default: Date.now },
  },
  { collection: 'gemelnet_cohort_annual', timestamps: false },
);

gemelNetCohortAnnualSchema.index({ year: 1, source: 1 }, { unique: true });

module.exports = mongoose.model('GemelNetCohortAnnual', gemelNetCohortAnnualSchema);
