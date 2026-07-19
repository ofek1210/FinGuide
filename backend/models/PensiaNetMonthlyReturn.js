'use strict';

const mongoose = require('mongoose');

/**
 * Investment-track monthly returns from Pensia-Net / data.gov.il.
 * FUND_ID = official Pensia-Net track (מסלול) identifier — NOT managing company.
 */
const pensiaNetMonthlyReturnSchema = new mongoose.Schema(
  {
    /** Official Pensia-Net track ID (FUND_ID) */
    trackId: { type: String, required: true, index: true },
    /** @deprecated use trackId — kept for backward compatibility */
    fundId: { type: String, index: true },
    trackName: { type: String, default: '' },
    fundName: { type: String, default: '' },
    classification: { type: String, default: '', index: true },
    managingCorporation: { type: String, default: '' },
    reportPeriod: { type: Number, required: true, index: true },
    reportYear: { type: Number, required: true, index: true },
    reportMonth: { type: Number, required: true, min: 1, max: 12 },
    /** Monthly return exactly as in source (percent, e.g. 0.48 = 0.48%) */
    monthlyYield: { type: Number, default: null },
    ytdYield: { type: Number, default: null },
    alpha: { type: Number, default: null },
    sharpeRatio: { type: Number, default: null },
    standardDeviation: { type: Number, default: null },
    stockExposure: { type: Number, default: null },
    source: { type: String, default: 'data_gov_ckan', enum: ['data_gov_ckan', 'pensyanet_excel'] },
    syncedAt: { type: Date, default: Date.now },
  },
  { collection: 'pensianet_monthly_returns', timestamps: false },
);

pensiaNetMonthlyReturnSchema.index({ trackId: 1, reportPeriod: 1 }, { unique: true });
pensiaNetMonthlyReturnSchema.index({ classification: 1, reportPeriod: 1 });

module.exports = mongoose.model('PensiaNetMonthlyReturn', pensiaNetMonthlyReturnSchema);
