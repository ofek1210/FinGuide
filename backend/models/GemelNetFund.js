'use strict';

const mongoose = require('mongoose');

const gemelNetFundSchema = new mongoose.Schema(
  {
    ID: { type: String, required: true, unique: true, index: true },
    SHM_KRN: { type: String, default: '' },
    SHM_TAAGID_MENAEL: { type: String, default: '' },
    SHM_TAAGID_SHOLET: { type: String, default: '' },
    SUG_KRN: { type: String, default: '' },
    SPECIALIZATION: { type: String, default: '', index: true },
    SUB_SPECIALIZATION: { type: String, default: '' },
    TARGET_POPULATION: { type: String, default: '' },
    TKUFAT_DUACH: { type: Number, default: null, index: true },
    SHIUR_D_NIHUL_AHARON_HAFKADOT: { type: Number, default: null },
    SHIUR_D_NIHUL_MEANUAL: { type: Number, default: null },
    SHIUR_D_NIHUL_AHARON_TTVURAH: { type: Number, default: null },
    TSUA_SHNATIT_MEMUZAAT_5_SHANIM: { type: Number, default: null, index: true },
    STIAT_TEKEN_36_HODASHIM: { type: Number, default: null },
    SHARPE_RATIO: { type: Number, default: null },
    BETA_HUTZ_LAARETZ: { type: Number, default: null },
    CHSHIF_MNUIOT: { type: Number, default: null },
    YITRAT_NECHASIM: { type: Number, default: null },
    NET_DOMAIN: { type: String, default: 'gemel' },
    syncedAt: { type: Date, default: Date.now },
    raw: { type: mongoose.Schema.Types.Mixed, select: false },
  },
  { collection: 'gemelnet_funds', timestamps: false },
);

gemelNetFundSchema.index({ TSUA_SHNATIT_MEMUZAAT_5_SHANIM: -1 });

module.exports = mongoose.model('GemelNetFund', gemelNetFundSchema);
