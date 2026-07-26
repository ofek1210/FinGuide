#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * AI intent routing evaluation.
 * Usage: npm run eval:ai-routing
 */

const fs = require('fs');
const path = require('path');

// detectIntent is internal; require via controller export
const { detectIntent } = require('../controllers/aiController');

const QUERIES = path.join(__dirname, 'fixtures', 'ai-routing-eval', 'queries.json');

function main() {
  const cases = JSON.parse(fs.readFileSync(QUERIES, 'utf8'));
  let correct = 0;
  let ruleRouted = 0;
  let llmRouted = 0;
  let misclassified = 0;

  console.log('=== AI intent routing evaluation ===\n');

  for (const c of cases) {
    const intent = detectIntent(c.query);
    const match = intent === c.expectedIntent;
    if (match) correct += 1;
    else misclassified += 1;

    const isLlm = intent === 'fallback';
    if (isLlm) llmRouted += 1;
    else ruleRouted += 1;

    const status = match ? 'OK' : 'MISS';
    console.log(`  [${status}] "${c.query.slice(0, 40)}" → ${intent} (expected ${c.expectedIntent})`);
  }

  const accuracy = cases.length > 0 ? (correct / cases.length) * 100 : 0;

  console.log('\n=== Aggregate ===');
  console.log(`  queries           : ${cases.length}`);
  console.log(`  intent correct    : ${correct} (${accuracy.toFixed(1)}%)`);
  console.log(`  misclassified     : ${misclassified}`);
  console.log(`  routed to rule    : ${ruleRouted}`);
  console.log(`  routed to fallback: ${llmRouted}`);

  return { correct, misclassified, ruleRouted, llmRouted, accuracy, total: cases.length };
}

if (require.main === module) {
  const result = main();
  // Fail CI on any misclassification (accuracy must be 100%).
  process.exit(result.accuracy < 100 ? 1 : 0);
}

module.exports = { main };
