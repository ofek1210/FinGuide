#!/usr/bin/env node
'use strict';

/**
 * Import Pensia-Net cohort annual Excel (tsuotHodPtihaRDL.xls) + optional CKAN monthly sync.
 *
 * Usage:
 *   node scripts/importPensiaNetCohortAnnual.js path/to/tsuotHodPtihaRDL.xls
 *   node scripts/importPensiaNetCohortAnnual.js path/to/file.xls --sync-monthly
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { importPensiaNetCohortAnnualExcel } = require('../services/pensiaNetCohortAnnualImportService');
const { syncPensiaNetDataset } = require('../services/pensiaNetIngestionService');

async function main() {
  const fileArg = process.argv[2];
  const doSync = process.argv.includes('--sync-monthly');

  if (!fileArg) {
    console.error('Usage: node scripts/importPensiaNetCohortAnnual.js <excel-path> [--sync-monthly]');
    process.exit(1);
  }

  const abs = path.resolve(fileArg);
  if (!fs.existsSync(abs)) {
    console.error('File not found:', abs);
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('[import] MongoDB connected');

  const buffer = fs.readFileSync(abs);
  const result = await importPensiaNetCohortAnnualExcel(buffer, { sourceFile: path.basename(abs) });
  console.log('[import] cohort annual:', result);

  if (doSync) {
    console.log('[import] syncing monthly returns from data.gov.il …');
    const sync = await syncPensiaNetDataset();
    console.log('[import] sync result:', sync);
  }

  await mongoose.disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
