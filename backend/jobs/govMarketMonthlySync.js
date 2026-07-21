'use strict';

const cron = require('node-cron');
const govConfig = require('../config/govDataConfig');
const { getLatestSyncMeta } = require('../services/govCkanIngestionService');
const {
  runFullMarketDataSync,
  getFullMarketDataStatus,
} = require('../services/govMarketFullSyncService');
const PensiaNetFund = require('../models/PensiaNetFund');
const GemelNetFund = require('../models/GemelNetFund');
const BituahNetFund = require('../models/BituahNetFund');

let scheduledTask = null;
let isRunning = false;

/**
 * Sync Pensia-Net + Gemel-Net + Bituah-Net + track history + cohort macro.
 * Downloads latest CSV from data.gov.il; falls back to CKAN API / local CSV.
 */
async function runGovMarketMonthlySync(opts = {}) {
  if (isRunning) {
    console.warn('[govMarketCron] sync already in progress — skipping');
    return { skipped: true, reason: 'already_running' };
  }

  isRunning = true;
  console.log('[govMarketCron] starting full gov market sync…');

  try {
    const result = await runFullMarketDataSync(opts);
    console.log('[govMarketCron] sync complete', {
      durationMs: result.durationMs,
      pensiaFunds: result.pensia?.uniqueFunds,
      gemelFunds: result.gemel?.uniqueFunds,
    });
    return result;
  } finally {
    isRunning = false;
  }
}

async function getGovMarketStatus() {
  const [pensia, gemel, bituah, extended] = await Promise.all([
    getLatestSyncMeta(PensiaNetFund),
    getLatestSyncMeta(GemelNetFund),
    getLatestSyncMeta(BituahNetFund),
    getFullMarketDataStatus(),
  ]);

  return {
    prefetchedAt: new Date().toISOString(),
    nets: {
      pensia: { sourceName: 'פנסיה-נט', ...pensia },
      gemel: { sourceName: 'גמל-נט', ...gemel },
      bituah: { sourceName: 'ביטוח-נט', ...bituah },
    },
    ...extended,
  };
}

function startGovMarketCron() {
  if (!govConfig.cronEnabled) {
    console.log('[govMarketCron] disabled (GOV_MARKET_CRON_ENABLED=false)');
    return null;
  }

  if (scheduledTask) return scheduledTask;

  if (!cron.validate(govConfig.cronSchedule)) {
    console.error('[govMarketCron] invalid cron:', govConfig.cronSchedule);
    return null;
  }

  scheduledTask = cron.schedule(
    govConfig.cronSchedule,
    () => {
      runGovMarketMonthlySync().catch(err => {
        console.error('[govMarketCron] unhandled error:', err);
      });
    },
    { timezone: govConfig.cronTimezone },
  );

  console.log(`[govMarketCron] scheduled "${govConfig.cronSchedule}" (${govConfig.cronTimezone})`);
  return scheduledTask;
}

function stopGovMarketCron() {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
  }
}

/**
 * On cold start, seed market data if collections are empty.
 */
async function ensureGovMarketSeeded() {
  const pensiaCount = await PensiaNetFund.estimatedDocumentCount();
  if (pensiaCount > 0) {
    return { skipped: true, reason: 'already_seeded', count: pensiaCount };
  }

  console.log('[govMarketCron] empty market collections — running initial full sync…');
  return runGovMarketMonthlySync();
}

module.exports = {
  runGovMarketMonthlySync,
  getGovMarketStatus,
  startGovMarketCron,
  stopGovMarketCron,
  ensureGovMarketSeeded,
};
