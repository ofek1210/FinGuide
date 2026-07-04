'use strict';

const mongoose = require('mongoose');

/**
 * Latest Pensia-Net market snapshot per fund (government open data).
 * Field names mirror legacy PensiaNet XML exports for compatibility.
 */
const pensiaNetFundSchema = new mongoose.Schema(
  {
    ID: { type: String, required: true, unique: true, index: true },
    SHM_KRN: { type: String, default: '' },
    SHM_TAAGID_MENAEL: { type: String, default: '' },
    SHM_TAAGID_SHOLET: { type: String, default: '' },
    SUG_KRN: { type: String, default: '' },
    TKUFAT_DUACH: { type: Number, default: null, index: true },
    /** Average management fee from deposits (%) — Engine A */
    SHIUR_D_NIHUL_AHARON_HAFKADOT: { type: Number, default: null },
    /** Average management fee from accumulation (%) — PensiaNet: SHIUR_D_NIHUL_MEANUAL / AHARON_TTVURAH */
    SHIUR_D_NIHUL_MEANUAL: { type: Number, default: null },
    SHIUR_D_NIHUL_AHARON_TTVURAH: { type: Number, default: null },
    /** 5-year average annual return (%) — Engine B sort key */
    TSUA_SHNATIT_MEMUZAAT_5_SHANIM: { type: Number, default: null, index: true },
    /** 36-month standard deviation (%) */
    STIAT_TEKEN_36_HODASHIM: { type: Number, default: null },
    SHARPE_RATIO: { type: Number, default: null },
    /** Foreign exposure (0–100 percent scale) */
    BETA_HUTZ_LAARETZ: { type: Number, default: null },
    CHSHIF_MNUIOT: { type: Number, default: null },
    /** Actuarial balance surplus/deficit — Engine C */
    ODEF_GIRAON_ACTUARI_LETKUFA: { type: Number, default: null },
    YITRAT_NECHASIM: { type: Number, default: null },
    syncedAt: { type: Date, default: Date.now },
    raw: { type: mongoose.Schema.Types.Mixed, select: false },
  },
  {
    collection: 'pensianet_funds',
    timestamps: false,
  },
);

pensiaNetFundSchema.index({ TSUA_SHNATIT_MEMUZAAT_5_SHANIM: -1 });
pensiaNetFundSchema.index({ STIAT_TEKEN_36_HODASHIM: 1 });

module.exports = mongoose.model('PensiaNetFund', pensiaNetFundSchema);
