'use strict';

const { mapApiRecordToPensiaNet, toNumber } = require('./pensiaNetFieldMapper');

function mapApiRecordToGemelNet(record) {
  if (!record || record.FUND_ID == null) return null;
  const base = mapApiRecordToPensiaNet(record);
  if (!base) return null;

  return {
    ...base,
    SPECIALIZATION: String(record.SPECIALIZATION || '').trim(),
    SUB_SPECIALIZATION: String(record.SUB_SPECIALIZATION || '').trim(),
    TARGET_POPULATION: String(record.TARGET_POPULATION || '').trim(),
    NET_DOMAIN: 'gemel',
  };
}

module.exports = { mapApiRecordToGemelNet, toNumber };
