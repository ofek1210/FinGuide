'use strict';

const cron = require('node-cron');
const govConfig = require('../config/govDataConfig');
const { syncPensiaNetDataset } = require('../services/pensiaNetIngestionService');
const { syncGemelNetDataset } = require('../services/gemelNetIngestionService');
const { syncBituahNetDataset } = require('../services/bituahNetIngestionService');
const { getLatestSyncMeta } = require('../services/govCkanIngestionService');
const PensiaNetFund = require('../models/PensiaNetFund');
const GemelNetFund = require('../models/GemelNetFund');
const BituahNetFund = require('../models/BituahNetFund');

let scheduledTask = null;
let isRunning = false;

/**
 * Sync Pensia-Net + Gemel-Net + Bituah-Net from data.gov.il (or local CSV fallback).
 */
async function runGovMarketMonthlySync() {
  if (isRunning) {
    console.warn('[govMarketCron] sync already in progress — skipping');
    return { skipped: true, reason: 'already_running' };
  }

  isRunning = true;
  const started = Date.now();
  console.log('[govMarketCron] starting gov market sync (pensia + gemel + bituah)…');

  try {
    const [pensia, gemel, bituah] = await Promise.allSettled([
      syncPensiaNetDataset(),
      syncGemelNetDataset(),
      syncBituahNetDataset(),
    ]);

    const result = {
      durationMs: Date.now() - started,
      pensia: pensia.status === 'fulfilled' ? pensia.value : { error: pensia.reason?.message },
      gemel: gemel.status === 'fulfilled' ? gemel.value : { error: gemel.reason?.message },
      bituah: bituah.status === 'fulfilled' ? bituah.value : { error: bituah.reason?.message },
    };

    console.log('[govMarketCron] sync complete', result);
    return result;
  } finally {
    isRunning = false;
  }
}

async function getGovMarketStatus() {
  const [pensia, gemel, bituah] = await Promise.all([
    getLatestSyncMeta(PensiaNetFund),
    getLatestSyncMeta(GemelNetFund),
    getLatestSyncMeta(BituahNetFund),
  ]);

  return {
    prefetchedAt: new Date().toISOString(),
    nets: {
      pensia: { sourceName: 'פנסיה-נט', ...pensia },
      gemel: { sourceName: 'גמל-נט', ...gemel },
      bituah: { sourceName: 'ביטוח-נט', ...bituah },
    },
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

module.exports = {
  runGovMarketMonthlySync,
  getGovMarketStatus,
  startGovMarketCron,
  stopGovMarketCron,
};
