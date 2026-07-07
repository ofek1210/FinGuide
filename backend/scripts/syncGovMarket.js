#!/usr/bin/env node
'use strict';

/**
 * Manual sync — Pensia-Net + Gemel-Net + Bituah-Net
 * Usage: npm run sync:gov
 */
require('dotenv').config();

const connectDB = require('../config/db');
const { runGovMarketMonthlySync } = require('../jobs/govMarketMonthlySync');

async function main() {
  await connectDB();
  const result = await runGovMarketMonthlySync();
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
