'use strict';

const mongoose = require('mongoose');

/**
 * Cohort-level annual returns exported from Pensia-Net UI
 * (tsuotHodPtihaRDL.xls — "סה\"כ נכסים ותשואות לפי סוג קרן").
 */
const pensiaNetCohortAnnualSchema = new mongoose.Schema(
  {
    source: { type: String, default: 'pensyanet_excel' },
    sourceFile: { type: String, default: null },
    reportLabel: { type: String, default: null },
    reportAsOf: { type: String, default: null },
    year: { type: Number, required: true, index: true },
    returnPctGeneral: { type: Number, default: null },
    returnPctNew: { type: Number, default: null },
    assetsGeneralMillions: { type: Number, default: null },
    assetsNewMillions: { type: Number, default: null },
    trailing12mReturnGeneral: { type: Number, default: null },
    trailing12mReturnNew: { type: Number, default: null },
    importedAt: { type: Date, default: Date.now },
  },
  { collection: 'pensianet_cohort_annual', timestamps: false },
);

pensiaNetCohortAnnualSchema.index({ year: 1, source: 1 }, { unique: true });

module.exports = mongoose.model('PensiaNetCohortAnnual', pensiaNetCohortAnnualSchema);
