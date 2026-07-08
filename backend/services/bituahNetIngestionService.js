'use strict';

const config = require('../config/bituahNetConfig');
const BituahNetFund = require('../models/BituahNetFund');
const { mapApiRecordToBituahNet } = require('../utils/bituahNetFieldMapper');
const { syncGovNetDataset, getLatestSyncMeta } = require('./govCkanIngestionService');

async function syncBituahNetDataset(opts = {}) {
  return syncGovNetDataset({
    config: { ...config, resourceId: opts.resourceId || config.resourceId },
    Model: BituahNetFund,
    mapper: mapApiRecordToBituahNet,
    netKey: 'bituah',
  });
}

async function getBituahNetStatus() {
  const meta = await getLatestSyncMeta(BituahNetFund);
  return { net: 'bituah', sourceName: config.sourceName, ...meta };
}

module.exports = { syncBituahNetDataset, getBituahNetStatus };
