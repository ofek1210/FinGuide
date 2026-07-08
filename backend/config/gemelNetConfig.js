'use strict';

const gov = require('./govDataConfig');

module.exports = {
  enabled: process.env.GEMELNET_ENABLED !== 'false',
  resourceId: process.env.GEMELNET_RESOURCE_ID || '',
  localCsvFile: process.env.GEMELNET_LOCAL_CSV || 'gemel-net.csv',
  localDataDir: gov.localDataDir,
  ckanBaseUrl: gov.ckanBaseUrl,
  pageSize: gov.pageSize,
  fetchTimeoutMs: gov.fetchTimeoutMs,
  userAgent: gov.userAgent,
  sourceName: 'גמל-נט (data.gov.il)',
};
