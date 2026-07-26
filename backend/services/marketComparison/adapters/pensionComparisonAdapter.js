'use strict';

const PensiaNetFund = require('../../../models/PensiaNetFund');
const { normalizePensiaNetRow } = require('../marketDataQualityService');

const PENSION_FIELDS = [
  'ID',
  'SHM_KRN',
  'SHM_TAAGID_MENAEL',
  'SHM_TAAGID_SHOLET',
  'SUG_KRN',
  'TKUFAT_DUACH',
  'SHIUR_D_NIHUL_AHARON_HAFKADOT',
  'SHIUR_D_NIHUL_MEANUAL',
  'SHIUR_D_NIHUL_AHARON_TTVURAH',
  'TSUA_12_HODASHIM',
  'TSUA_36_HODASHIM',
  'TSUA_SHNATIT_MEMUZAAT_5_SHANIM',
  'CHSHIF_MNUIOT',
  'BETA_HUTZ_LAARETZ',
  'YITRAT_NECHASIM',
  'syncedAt',
].join(' ');

async function loadPensionComparisonRecords() {
  const rows = await PensiaNetFund.find({}).select(PENSION_FIELDS).lean();
  const records = rows.map(normalizePensiaNetRow);
  const meta = records.reduce(
    (acc, record) => {
      if (record.lastSyncedAt && (!acc.lastUpdated || record.lastSyncedAt > acc.lastUpdated)) {
        acc.lastUpdated = record.lastSyncedAt;
      }
      if (record.reportPeriod != null && record.reportPeriod > (acc.latestReportPeriod ?? 0)) {
        acc.latestReportPeriod = record.reportPeriod;
      }
      return acc;
    },
    { lastUpdated: null, latestReportPeriod: null },
  );

  return {
    records,
    meta,
    source: 'pensianet',
  };
}

module.exports = {
  loadPensionComparisonRecords,
};
