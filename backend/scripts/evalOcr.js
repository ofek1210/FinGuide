#!/usr/bin/env node
/* eslint-disable no-console, no-await-in-loop, no-restricted-syntax */

/**
 * OCR field-extraction accuracy harness.
 *
 * Walks every subdirectory of backend/services/__fixtures__/golden/ that
 * contains both an input file and expected.json, runs the production
 * extraction pipeline on each, and prints a per-field accuracy report.
 *
 * Usage:
 *   npm run eval:ocr                  # run all fixtures
 *   npm run eval:ocr -- --only=<name> # restrict to fixture(s) by substring
 *   npm run eval:ocr -- --verbose     # show per-fixture diff lines
 */

const fs = require('fs/promises');
const path = require('path');

const { extractPayslipFile } = require('../services/payslipOcr');

const GOLDEN_DIR = path.resolve(__dirname, '..', 'services', '__fixtures__', 'golden');
const SKIP_DIRS = new Set(['_template']);
const INPUT_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.tiff', '.tif'];

const TRACKED_FIELDS = [
  'period_month',
  'gross_total',
  'net_payable',
  'mandatory_total',
  'income_tax',
  'national_insurance',
  'health_insurance',
  'employee_id',
];

function parseArgs(argv) {
  const args = { only: null, verbose: false };
  for (const arg of argv.slice(2)) {
    if (arg === '--verbose' || arg === '-v') args.verbose = true;
    else if (arg.startsWith('--only=')) args.only = arg.slice('--only='.length);
  }
  return args;
}

function normalizePeriod(value) {
  if (value == null) return null;
  const str = String(value).trim();
  const yyyymm = str.match(/^(\d{4})[-/](\d{1,2})$/);
  if (yyyymm) return `${yyyymm[1]}-${yyyymm[2].padStart(2, '0')}`;
  const mmyyyy = str.match(/^(\d{1,2})[/-](\d{4})$/);
  if (mmyyyy) return `${mmyyyy[2]}-${mmyyyy[1].padStart(2, '0')}`;
  return str;
}

function pickActualField(analysisData, field) {
  const summary = analysisData?.summary || {};
  const salary = analysisData?.salary || {};
  const mandatory = analysisData?.deductions?.mandatory || {};
  const period = analysisData?.period?.month;
  const parties = analysisData?.parties || {};

  switch (field) {
    case 'period_month': return period ?? summary.date ?? null;
    case 'gross_total': return salary.gross_total ?? summary.grossSalary ?? null;
    case 'net_payable': return salary.net_payable ?? summary.netSalary ?? null;
    case 'mandatory_total': return mandatory.total ?? summary.mandatoryDeductionsTotal ?? null;
    case 'income_tax': return mandatory.income_tax ?? summary.tax ?? null;
    case 'national_insurance': return mandatory.national_insurance ?? summary.nationalInsurance ?? null;
    case 'health_insurance': return mandatory.health_insurance ?? summary.healthInsurance ?? null;
    case 'employee_id': return parties.employee_id ?? summary.employeeId ?? null;
    default: return null;
  }
}

function compareField(field, expected, actual) {
  if (expected == null || expected === '') return { status: 'skipped' };
  if (actual == null || actual === '') return { status: 'missing', expected, actual: null };

  if (field === 'period_month') {
    const ex = normalizePeriod(expected);
    const ac = normalizePeriod(actual);
    return ex === ac
      ? { status: 'match', expected: ex, actual: ac }
      : { status: 'mismatch', expected: ex, actual: ac };
  }

  if (field === 'employee_id') {
    const ex = String(expected).trim();
    const ac = String(actual).trim();
    return ex === ac
      ? { status: 'match', expected: ex, actual: ac }
      : { status: 'mismatch', expected: ex, actual: ac };
  }

  const exNum = Number(expected);
  const acNum = Number(actual);
  if (!Number.isFinite(exNum) || !Number.isFinite(acNum)) {
    return { status: 'mismatch', expected, actual };
  }
  const tolerance = Math.max(0.01, Math.abs(exNum) * 0.005);
  return Math.abs(exNum - acNum) <= tolerance
    ? { status: 'match', expected: exNum, actual: acNum }
    : { status: 'mismatch', expected: exNum, actual: acNum };
}

async function findInputFile(fixtureDir) {
  const entries = await fs.readdir(fixtureDir);
  for (const ext of INPUT_EXTENSIONS) {
    const match = entries.find(e => e.toLowerCase() === `input${ext}`);
    if (match) return path.join(fixtureDir, match);
  }
  return null;
}

async function loadFixtures({ only }) {
  let dirs;
  try {
    dirs = await fs.readdir(GOLDEN_DIR, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.error(`Golden directory not found at ${GOLDEN_DIR}.`);
      process.exit(2);
    }
    throw error;
  }

  const fixtures = [];
  for (const entry of dirs) {
    if (!entry.isDirectory()) continue;
    if (SKIP_DIRS.has(entry.name)) continue;
    if (only && !entry.name.includes(only)) continue;

    const fixtureDir = path.join(GOLDEN_DIR, entry.name);
    const expectedPath = path.join(fixtureDir, 'expected.json');

    let expected;
    try {
      const raw = await fs.readFile(expectedPath, 'utf8');
      expected = JSON.parse(raw);
    } catch (error) {
      console.warn(`[skip] ${entry.name}: expected.json missing or invalid (${error.code || error.message})`);
      continue;
    }

    const inputPath = await findInputFile(fixtureDir);
    if (!inputPath) {
      console.warn(`[skip] ${entry.name}: no input.{pdf,jpg,png,...} found`);
      continue;
    }

    fixtures.push({ name: entry.name, inputPath, expected });
  }
  return fixtures;
}

function fmtValue(value) {
  if (value == null) return '—';
  if (typeof value === 'number') return value.toFixed(2);
  return String(value);
}

function pad(str, width) {
  const s = String(str ?? '');
  return s.length >= width ? s : s + ' '.repeat(width - s.length);
}

function printReport(fixtureResults, { verbose }) {
  const fieldStats = Object.fromEntries(
    TRACKED_FIELDS.map(f => [f, { match: 0, mismatch: 0, missing: 0, skipped: 0, confusion: [] }]),
  );
  let resolutionScoreSum = 0;
  let confidenceSum = 0;
  let warningSum = 0;
  let scoredCount = 0;

  for (const result of fixtureResults) {
    if (verbose) console.log(`\n--- ${result.name} ---`);
    for (const field of TRACKED_FIELDS) {
      const cmp = result.comparisons[field];
      fieldStats[field][cmp.status] += 1;
      if (verbose) {
        console.log(`  ${pad(field, 22)} ${cmp.status.padEnd(8)} expected=${fmtValue(cmp.expected)} actual=${fmtValue(cmp.actual)}`);
      }
      if (cmp.status === 'mismatch' || cmp.status === 'missing') {
        fieldStats[field].confusion.push({
          fixture: result.name,
          expected: cmp.expected ?? null,
          actual: cmp.actual ?? null,
        });
      }
    }
    if (Number.isFinite(result.resolutionScore)) {
      resolutionScoreSum += result.resolutionScore;
      confidenceSum += result.confidence;
      warningSum += result.warningCount;
      scoredCount += 1;
    }
  }

  console.log('\n=== Per-field accuracy ===');
  console.log(`${pad('field', 22)}${pad('match', 7)}${pad('mismatch', 10)}${pad('missing', 9)}${pad('skipped', 9)}accuracy`);
  console.log('-'.repeat(70));
  for (const field of TRACKED_FIELDS) {
    const s = fieldStats[field];
    const measured = s.match + s.mismatch + s.missing;
    const accuracy = measured === 0 ? 'n/a' : `${((s.match / measured) * 100).toFixed(1)}%`;
    console.log(`${pad(field, 22)}${pad(s.match, 7)}${pad(s.mismatch, 10)}${pad(s.missing, 9)}${pad(s.skipped, 9)}${accuracy}`);
  }

  console.log('\n=== Confusion ===');
  let anyConfusion = false;
  for (const field of TRACKED_FIELDS) {
    const rows = fieldStats[field].confusion;
    if (!rows.length) continue;
    anyConfusion = true;
    console.log(`\n${field}:`);
    for (const row of rows) {
      console.log(`  ${pad(row.fixture, 30)} expected=${fmtValue(row.expected)} actual=${fmtValue(row.actual)}`);
    }
  }
  if (!anyConfusion) console.log('  (none — all measured fields matched within tolerance)');

  console.log('\n=== Aggregate ===');
  console.log(`  fixtures run         : ${fixtureResults.length}`);
  if (scoredCount) {
    console.log(`  avg resolution_score : ${(resolutionScoreSum / scoredCount).toFixed(3)}`);
    console.log(`  avg confidence       : ${(confidenceSum / scoredCount).toFixed(3)}`);
    console.log(`  avg warnings/fixture : ${(warningSum / scoredCount).toFixed(2)}`);
  }
}

async function run() {
  const args = parseArgs(process.argv);
  const fixtures = await loadFixtures(args);

  if (!fixtures.length) {
    console.log('No fixtures found.');
    console.log(`Expected directory: ${GOLDEN_DIR}`);
    console.log('See backend/services/__fixtures__/golden/README.md for the layout.');
    process.exit(0);
  }

  console.log(`Running OCR eval against ${fixtures.length} fixture(s)...`);

  const results = [];
  for (const fixture of fixtures) {
    process.stdout.write(`  • ${fixture.name} ... `);
    try {
      const start = Date.now();
      const { data } = await extractPayslipFile(fixture.inputPath);
      const elapsed = Date.now() - start;

      const comparisons = {};
      for (const field of TRACKED_FIELDS) {
        const actual = pickActualField(data, field);
        comparisons[field] = compareField(field, fixture.expected[field], actual);
      }

      const matchCount = Object.values(comparisons).filter(c => c.status === 'match').length;
      const measured = Object.values(comparisons).filter(c => c.status !== 'skipped').length;
      process.stdout.write(`${matchCount}/${measured} matched (${elapsed}ms)\n`);

      results.push({
        name: fixture.name,
        comparisons,
        resolutionScore: data?.quality?.resolution_score,
        confidence: data?.quality?.confidence,
        warningCount: Array.isArray(data?.quality?.warnings) ? data.quality.warnings.length : 0,
      });
    } catch (error) {
      process.stdout.write(`FAILED — ${error.message}\n`);
      results.push({
        name: fixture.name,
        comparisons: Object.fromEntries(TRACKED_FIELDS.map(f => [f, { status: 'missing', expected: fixture.expected[f], actual: null }])),
        resolutionScore: NaN,
        confidence: NaN,
        warningCount: 0,
      });
    }
  }

  printReport(results, args);
}

run().catch(error => {
  console.error(error);
  process.exit(1);
});
