#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * Measure synchronous Path-1 extraction latency on golden PDF fixtures.
 * Usage: node scripts/benchUploadLatency.js
 */

const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');
const { extractPayslipFile } = require('../services/payslipOcr');

const GOLDEN_ROOT = path.join(__dirname, '..', 'services', '__fixtures__', 'golden');

function listFixtureDirs() {
  return fs
    .readdirSync(GOLDEN_ROOT, { withFileTypes: true })
    .filter(d => d.isDirectory() && !d.name.startsWith('_'))
    .map(d => path.join(GOLDEN_ROOT, d.name));
}

async function timeFixture(dir) {
  const pdf = ['input.pdf', 'payslip.pdf'].map(f => path.join(dir, f)).find(p => fs.existsSync(p));
  if (!pdf) return null;
  const start = performance.now();
  await extractPayslipFile(pdf);
  const ms = performance.now() - start;
  return { id: path.basename(dir), ms };
}

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

async function main() {
  const dirs = listFixtureDirs();
  const results = [];
  for (const dir of dirs) {
    const row = await timeFixture(dir);
    if (row) results.push(row);
  }
  const times = results.map(r => r.ms).sort((a, b) => a - b);
  const summary = {
    n: results.length,
    minMs: times[0]?.toFixed(0),
    medianMs: percentile(times, 50).toFixed(0),
    maxMs: times[times.length - 1]?.toFixed(0),
    meanMs: (times.reduce((a, b) => a + b, 0) / (times.length || 1)).toFixed(0),
  };

  console.log('=== Upload/extraction latency (Path 1, golden fixtures) ===');
  results.forEach(r => console.log(`  ${r.id}: ${r.ms.toFixed(0)} ms`));
  console.log('\n=== Aggregate ===');
  console.log(JSON.stringify(summary, null, 2));
  return { results, summary };
}

if (require.main === module) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { main };
