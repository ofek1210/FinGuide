'use strict';

const gov = require('./govDataConfig');

module.exports = {
  enabled: process.env.PENSIANET_ENABLED !== 'false',
  cronEnabled: process.env.PENSIANET_CRON_ENABLED !== 'false',
  /** 18th of every month at 02:00 — Israel time */
  cronSchedule: process.env.PENSIANET_CRON_SCHEDULE || '0 2 18 * *',
  cronTimezone: process.env.PENSIANET_CRON_TZ || 'Asia/Jerusalem',
  ckanBaseUrl: process.env.PENSIANET_CKAN_URL || 'https://data.gov.il/api/3/action',
  /** Current resource (2024–today) — updated daily by CMA */
  resourceId: process.env.PENSIANET_RESOURCE_ID || '6d47d6b5-cb08-488b-b333-f1e717b1e1bd',
  pageSize: Number(process.env.PENSIANET_PAGE_SIZE) || 1000,
  fetchTimeoutMs: Number(process.env.PENSIANET_FETCH_TIMEOUT_MS) || 30000,
  userAgent: process.env.PENSIANET_USER_AGENT || 'FinGuide/1.0 (pensianet-sync; +https://github.com/ofek1210/FinGuide)',
  localCsvFile: process.env.PENSIANET_LOCAL_CSV || 'pensia-net.csv',
  localDataDir: gov.localDataDir,
  pageSizeGov: gov.pageSize,
  /** Low-risk: std-dev below this percentile among cohort */
  lowRiskStdDevPercentile: 40,
  /** Low-risk: minimum Sharpe for "stable" funds */
  lowRiskMinSharpe: 0.45,
  sourceName: 'פנסיה-נט (data.gov.il)',
};
