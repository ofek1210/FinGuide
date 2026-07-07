#!/usr/bin/env node



const { TRACKS, MARKET_AVERAGES, TOP_QUARTILE } = require('../config/pensionBenchmarkTables');

let errors = 0;

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  errors += 1;
}

for (const track of TRACKS) {
  if (track.mgmtFeeAccumulation < 0 || track.mgmtFeeAccumulation > 0.02) {
    fail(`track ${track.id} mgmtFeeAccumulation out of range: ${track.mgmtFeeAccumulation}`);
  }
  if (track.rank < 1 || track.rank > 100) {
    fail(`track ${track.id} rank out of range: ${track.rank}`);
  }
}

const ids = TRACKS.map(t => t.id);
if (new Set(ids).size !== ids.length) {
  fail('duplicate track ids in TRACKS');
}

for (const [productType, risks] of Object.entries(MARKET_AVERAGES)) {
  for (const [risk, avg] of Object.entries(risks)) {
    if (avg.mgmtFeeAccumulation <= 0 || avg.mgmtFeeAccumulation > 0.02) {
      fail(`${productType}.${risk} market avg fee invalid`);
    }
  }
}

if (TOP_QUARTILE.mgmtFeeAccumulation <= 0) {
  fail('TOP_QUARTILE.mgmtFeeAccumulation invalid');
}

if (errors > 0) {
  console.error(`\n${errors} validation error(s)`);
  process.exit(1);
}

console.log(`OK: ${TRACKS.length} tracks, ${Object.keys(MARKET_AVERAGES).length} product types`);
