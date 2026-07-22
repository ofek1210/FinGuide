'use strict';

/**
 * Step 2 readiness check: resync GemelNet (optional) and verify product + return coverage.
 *
 * Usage (from backend/):
 *   node scripts/verify-gemel-market-readiness.js
 *   node scripts/verify-gemel-market-readiness.js --sync
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { syncGemelNetDataset } = require('../services/gemelNetIngestionService');
const { getGemelDataQualityFromDb } = require('../services/marketComparison/gemelDataQualityService');

const EXPECTED = {
  totalFunds: 940,
  publicProductCounts: {
    gemel: 314,
    hishtalmut: 267,
    investment_gemel: 168,
  },
  excludedFromPublicTable: {
    child_savings: 40,
    central_severance: 56,
    unknownEmptyClassification: 90,
    unknownOtherPurpose: 5,
    unknownUnrecognized: 0,
  },
};

function assertEqual(label, actual, expected) {
  const ok = actual === expected;
  console.log(`${ok ? '✓' : '✗'} ${label}: ${actual}${ok ? '' : ` (expected ${expected})`}`);
  return ok;
}

async function main() {
  const shouldSync = process.argv.includes('--sync');
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is required');
    process.exit(1);
  }

  await mongoose.connect(uri);

  if (shouldSync) {
    console.log('Syncing GemelNet dataset…');
    const syncResult = await syncGemelNetDataset();
    console.log(JSON.stringify(syncResult, null, 2));
  }

  const report = await getGemelDataQualityFromDb();
  console.log('\n--- GemelNet data quality ---');
  console.log(JSON.stringify(report, null, 2));

  let allOk = true;
  allOk = assertEqual('totalFunds', report.totalFunds, EXPECTED.totalFunds) && allOk;
  allOk =
    assertEqual('public gemel', report.publicProductCounts.gemel, EXPECTED.publicProductCounts.gemel) &&
    allOk;
  allOk =
    assertEqual(
      'public hishtalmut',
      report.publicProductCounts.hishtalmut,
      EXPECTED.publicProductCounts.hishtalmut,
    ) && allOk;
  allOk =
    assertEqual(
      'public investment_gemel',
      report.publicProductCounts.investment_gemel,
      EXPECTED.publicProductCounts.investment_gemel,
    ) && allOk;

  const ex = report.excludedFromPublicTable;
  const exp = EXPECTED.excludedFromPublicTable;
  allOk = assertEqual('excluded child_savings', ex.child_savings, exp.child_savings) && allOk;
  allOk =
    assertEqual('excluded central_severance', ex.central_severance, exp.central_severance) && allOk;
  allOk =
    assertEqual(
      'excluded unknown empty SUG',
      ex.unknownEmptyClassification,
      exp.unknownEmptyClassification,
    ) && allOk;
  allOk =
    assertEqual('excluded unknown other purpose', ex.unknownOtherPurpose, exp.unknownOtherPurpose) &&
    allOk;

  const cov = report.returnFieldCoverage.allFunds;
  console.log('\n--- Return field coverage (all funds) ---');
  console.log(`  TSUA_12_HODASHIM: ${cov.return12Months}/${report.totalFunds}`);
  console.log(`  TSUA_36_HODASHIM: ${cov.return36MonthsAnnualized}/${report.totalFunds}`);
  console.log(
    `  TSUA_SHNATIT_MEMUZAAT_5_SHANIM: ${cov.return5YearsAnnualized}/${report.totalFunds}`,
  );

  if (cov.return12Months === 0 || cov.return36MonthsAnnualized === 0) {
    console.error('\n✗ Return fields missing after resync — run with --sync or check CSV mapper.');
    allOk = false;
  }

  await mongoose.disconnect();
  process.exit(allOk ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
