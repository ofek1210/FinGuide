'use strict';

const config = require('../config/gemelNetConfig');
const GemelNetFund = require('../models/GemelNetFund');
const { mapApiRecordToGemelNet } = require('../utils/gemelNetFieldMapper');
const { syncGovNetDataset, getLatestSyncMeta } = require('./govCkanIngestionService');

async function syncGemelNetDataset(opts = {}) {
  return syncGovNetDataset({
    config: { ...config, resourceId: opts.resourceId || config.resourceId },
    Model: GemelNetFund,
    mapper: mapApiRecordToGemelNet,
    netKey: 'gemel',
  });
}

async function getGemelNetStatus() {
  const meta = await getLatestSyncMeta(GemelNetFund);
  return { net: 'gemel', sourceName: config.sourceName, ...meta };
}

module.exports = { syncGemelNetDataset, getGemelNetStatus };
