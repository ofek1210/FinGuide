#!/usr/bin/env node
'use strict';

/**
 * Sync investment-track monthly returns from data.gov.il (Pensia-Net CKAN).
 * Does NOT update PensiaNetFund snapshot — monthly history only.
 *
 * Usage:
 *   node scripts/syncPensiaNetTrackMonthly.js           # dry-run (validate only)
 *   node scripts/syncPensiaNetTrackMonthly.js --commit  # write to DB
 *   node scripts/syncPensiaNetTrackMonthly.js --commit --samples 3
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const {
  syncPensiaNetTrackMonthly,
  sampleTrackCompoundedReturns,
  pickSampleTracksForReport,
} = require('../services/pensiaNetTrackMonthlySyncService');

async function main() {
  const commit = process.argv.includes('--commit');
  const sampleCount = Number(process.argv.find(a => a.startsWith('--samples='))?.split('=')[1] || 3);

  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is required');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('[sync] MongoDB connected');
  console.log(`[sync] mode: ${commit ? 'COMMIT (monthly returns only)' : 'DRY-RUN (no writes)'}`);
  console.log('[sync] PensiaNetFund snapshot will NOT be updated\n');

  const result = await syncPensiaNetTrackMonthly({ dryRun: !commit });
  printReport(result);

  if (commit && result.tracksIdentified > 0) {
    const trackIds = await pickSampleTracksForReport(sampleCount);
    const samples = await sampleTrackCompoundedReturns(trackIds);
    console.log('\n=== דוגמאות מסלולים (תשואה מצטברת מ-compounding) ===\n');
    console.log(JSON.stringify(samples, null, 2));
  }

  await mongoose.disconnect();
}

function printReport(result) {
  console.log('=== דוח סנכרון תשואות חודשיות — מסלולי השקעה ===\n');
  if (result.skipped) {
    console.log('Skipped:', result.reason);
    return;
  }
  console.log(`שורות שנקראו:        ${result.rowsRead}`);
  console.log(`מסלולים שזוהו:       ${result.tracksIdentified}`);
  console.log(`רשומות שנוספו:       ${result.recordsAdded}`);
  console.log(`רשומות שעודכנו:      ${result.recordsUpdated}`);
  console.log(`רשומות שנדחו:        ${result.recordsRejected}`);
  console.log(`עדכון snapshot:      ${result.snapshotUpdated ? 'כן' : 'לא'}`);
  console.log(`dry-run:             ${result.dryRun ? 'כן' : 'לא'}`);

  if (result.rejectionReasons?.length) {
    console.log('\n--- סיבות לדחייה ---');
    for (const r of result.rejectionReasons) {
      console.log(`  ${r.label}: ${r.count}`);
    }
  }

  if (result.rejectedSamples?.length) {
    console.log('\n--- דוגמאות נדחו ---');
    for (const s of result.rejectedSamples.slice(0, 5)) {
      console.log(`  ${s.reasonLabel} | track=${s.fundId} period=${s.reportPeriod}`);
    }
  }

  if (result.unmatchedTracks?.length) {
    console.log('\n--- מסלולים עם היסטוריה חלקית (<12 חודשים) ---');
    for (const t of result.unmatchedTracks.slice(0, 10)) {
      console.log(`  trackId=${t.trackId} months=${t.monthsStored}`);
    }
  }
}

main().catch(err => {
  console.error('[sync] failed:', err);
  process.exit(1);
});
