'use strict';

const gov = require('./govDataConfig');

module.exports = {
  enabled: process.env.BITUAHNET_ENABLED !== 'false',
  resourceId: process.env.BITUAHNET_RESOURCE_ID || '',
  localCsvFile: process.env.BITUAHNET_LOCAL_CSV || 'bituah-net.csv',
  localDataDir: gov.localDataDir,
  ckanBaseUrl: gov.ckanBaseUrl,
  pageSize: gov.pageSize,
  fetchTimeoutMs: gov.fetchTimeoutMs,
  userAgent: gov.userAgent,
  sourceName: 'ביטוח-נט (data.gov.il)',
};
