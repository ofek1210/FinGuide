'use strict';

const GemelNetFund = require('../../../models/GemelNetFund');
const { normalizeGemelNetRow } = require('../marketDataQualityService');

const GEMEL_FIELDS = [
  'ID',
  'SHM_KRN',
  'SHM_TAAGID_MENAEL',
  'SHM_TAAGID_SHOLET',
  'SUG_KRN',
  'SPECIALIZATION',
  'SUB_SPECIALIZATION',
  'TKUFAT_DUACH',
  'SHIUR_D_NIHUL_AHARON_HAFKADOT',
  'SHIUR_D_NIHUL_MEANUAL',
  'SHIUR_D_NIHUL_AHARON_TTVURAH',
  'TSUA_12_HODASHIM',
  'TSUA_36_HODASHIM',
  'TSUA_SHNATIT_MEMUZAAT_5_SHANIM',
  'CHSHIF_MNUIOT',
  'YITRAT_NECHASIM',
  'syncedAt',
].join(' ');

async function loadGemelNetRecords() {
  return GemelNetFund.find({}).select(GEMEL_FIELDS).lean();
}

function normalizeGemelRecords(rows, { productType = null } = {}) {
  const normalized = rows.map(normalizeGemelNetRow);
  if (!productType) return normalized;
  return normalized.filter((record) => record.productType === productType);
}

function latestSyncMeta(records) {
  return records.reduce(
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
}

async function loadGemelNetComparisonRecords(productType) {
  const rows = await loadGemelNetRecords();
  const records = normalizeGemelRecords(rows, { productType });
  return {
    records,
    meta: latestSyncMeta(records),
    source: 'gemelnet',
  };
}

module.exports = {
  GEMEL_FIELDS,
  loadGemelNetRecords,
  normalizeGemelRecords,
  latestSyncMeta,
  loadGemelNetComparisonRecords,
};
