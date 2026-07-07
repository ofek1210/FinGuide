

const cron = require('node-cron');
const config = require('../config/pensiaNetConfig');
const PensiaNetFund = require('../models/PensiaNetFund');
const { syncPensiaNetDataset } = require('../services/pensiaNetIngestionService');

let scheduledTask = null;
let isRunning = false;

/**
 * Run Pensia-Net sync once (safe for manual scripts + cron).
 */
async function runPensiaNetMonthlySync() {
  if (isRunning) {
    console.warn('[pensiaNetCron] sync already in progress — skipping');
    return { skipped: true, reason: 'already_running' };
  }

  isRunning = true;
  const started = Date.now();
  console.log('[pensiaNetCron] starting monthly Pensia-Net sync…');

  try {
    const result = await syncPensiaNetDataset();
    console.log('[pensiaNetCron] sync complete', {
      ...result,
      durationMs: Date.now() - started,
    });
    return result;
  } catch (err) {
    console.error('[pensiaNetCron] sync failed:', err.message);
    throw err;
  } finally {
    isRunning = false;
  }
}

/**
 * Register node-cron job — 18th of every month at 02:00 (Asia/Jerusalem).
 * Call once after DB connection in server.js.
 */
function startPensiaNetCron() {
  if (!config.enabled || !config.cronEnabled) {
    console.log('[pensiaNetCron] disabled (PENSIANET_ENABLED / PENSIANET_CRON_ENABLED)');
    return null;
  }

  if (scheduledTask) return scheduledTask;

  if (!cron.validate(config.cronSchedule)) {
    console.error('[pensiaNetCron] invalid cron expression:', config.cronSchedule);
    return null;
  }

  scheduledTask = cron.schedule(
    config.cronSchedule,
    () => {
      runPensiaNetMonthlySync().catch(err => {
        console.error('[pensiaNetCron] unhandled sync error:', err);
      });
    },
    { timezone: config.cronTimezone },
  );

  console.log(`[pensiaNetCron] scheduled "${config.cronSchedule}" (${config.cronTimezone})`);
  return scheduledTask;
}

function stopPensiaNetCron() {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
  }
}

/**
 * On cold start, seed market data if the collection is empty (cron alone waits until the 18th).
 */
async function ensurePensiaNetSeeded() {
  if (!config.enabled) {
    return { skipped: true, reason: 'PENSIANET_ENABLED=false' };
  }

  const count = await PensiaNetFund.estimatedDocumentCount();
  if (count > 0) {
    return { skipped: true, reason: 'already_seeded', count };
  }

  console.log('[pensiaNetCron] empty PensiaNetFund collection — running initial sync…');
  return runPensiaNetMonthlySync();
}

module.exports = {
  runPensiaNetMonthlySync,
  startPensiaNetCron,
  stopPensiaNetCron,
  ensurePensiaNetSeeded,
};
