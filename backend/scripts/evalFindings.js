#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * Findings engine precision/recall evaluation on annotated scenarios.
 * Usage: npm run eval:findings
 */

const fs = require('fs');
const path = require('path');
const { buildFundDepositFindings } = require('../utils/detectFundWithoutDeposit');
const { buildContributionRateGapFindings } = require('../utils/detectContributionRateGap');
const { buildDepositContinuityFindings } = require('../utils/detectDepositContinuityGap');

const SCENARIOS = path.join(__dirname, 'fixtures', 'findings-eval', 'scenarios.json');

function collectFindings(documents, onboarding) {
  const user = { onboarding: onboarding || {} };
  const all = [
    ...buildFundDepositFindings(documents, user),
    ...buildContributionRateGapFindings(documents),
    ...(buildDepositContinuityFindings(documents).findings || []),
  ];
  return all;
}

function findingKinds(findings) {
  return [...new Set(findings.map(f => f.meta?.findingKind).filter(Boolean))];
}

function main() {
  const scenarios = JSON.parse(fs.readFileSync(SCENARIOS, 'utf8'));
  let tp = 0;
  let fp = 0;
  let fn = 0;
  const details = [];

  for (const scenario of scenarios) {
    const expected = new Set(scenario.expectedFindingKinds || []);
    const actual = new Set(findingKinds(collectFindings(scenario.documents, scenario.onboarding)));

    for (const kind of expected) {
      if (actual.has(kind)) tp += 1;
      else fn += 1;
    }
    for (const kind of actual) {
      if (!expected.has(kind)) fp += 1;
    }

    details.push({
      id: scenario.id,
      expected: [...expected],
      actual: [...actual],
      match: expected.size === actual.size && [...expected].every(k => actual.has(k)),
    });
  }

  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;

  console.log('=== Findings evaluation ===');
  details.forEach(d => {
    console.log(`  ${d.id}: ${d.match ? 'OK' : 'MISMATCH'} expected=[${d.expected}] actual=[${d.actual}]`);
  });
  console.log('\n=== Aggregate ===');
  console.log(`  scenarios   : ${scenarios.length}`);
  console.log(`  true_pos    : ${tp}`);
  console.log(`  false_pos   : ${fp}`);
  console.log(`  false_neg   : ${fn}`);
  console.log(`  precision   : ${(precision * 100).toFixed(1)}%`);
  console.log(`  recall      : ${(recall * 100).toFixed(1)}%`);

  return { tp, fp, fn, precision, recall, scenarios: scenarios.length };
}

if (require.main === module) {
  main();
}

module.exports = { main };
