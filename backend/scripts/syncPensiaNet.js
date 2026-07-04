#!/usr/bin/env node
'use strict';

/**
 * Manual Pensia-Net sync — same pipeline as the monthly cron job.
 * Usage: node scripts/syncPensiaNet.js
 */
require('dotenv').config();

const connectDB = require('../config/db');
const { runPensiaNetMonthlySync } = require('../jobs/pensiaNetMonthlySync');

async function main() {
  await connectDB();
  const result = await runPensiaNetMonthlySync();
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
