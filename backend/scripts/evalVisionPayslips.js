#!/usr/bin/env node
/* eslint-disable no-console, no-await-in-loop, no-restricted-syntax */

/**
 * End-to-end Vision payslip extraction eval.
 *
 * Requires:
 *   ANTHROPIC_API_KEY in backend/.env
 *   PAYSLIP_EXTRACTION_MODE=vision  (set automatically unless --legacy)
 *
 * Usage:
 *   npm run eval:vision                              # all vision-* golden fixtures
 *   npm run eval:vision -- --only=june               # filter fixtures by name
 *   npm run eval:vision -- --pdf uploads/foo.pdf     # single PDF
 *   npm run eval:vision -- --ids=<mongoId> --write   # reprocess DB docs via vision
 */

const fs = require('fs/promises');
const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Document = require('../models/Document');
const { extractPayslipFile } = require('../services/payslipOcr');
const { isVisionExtractionMode } = require('../config/payslipExtractionConfig');

const GOLDEN_DIR = path.resolve(__dirname, '..', 'services', '__fixtures__', 'golden');
const INPUT_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg'];

const CONTRIBUTION_FIELDS = [
  ['pension_employee', d => d.contributions?.pension?.employee],
  ['pension_employer', d => d.contributions?.pension?.employer],
  ['pension_total', d => d.contributions?.pension?.participation_total],
  ['study_employee', d => d.contributions?.study_fund?.employee],
  ['study_employer', d => d.contributions?.study_fund?.employer],
  ['study_total', d => d.contributions?.study_fund?.participation_total],
];

const SALARY_FIELDS = [
  ['gross_total', d => d.salary?.gross_total],
  ['net_payable', d => d.salary?.net_payable],
  ['period_month', d => d.period?.month],
];

function parseArgs(argv) {
  const options = {
    only: null,
    pdf: null,
    ids: [],
    write: false,
    forceVision: true,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--write') options.write = true;
    else if (arg === '--legacy') options.forceVision = false;
    else if (arg.startsWith('--only=')) options.only = arg.slice('--only='.length);
    else if (arg.startsWith('--pdf=')) options.pdf = arg.slice('--pdf='.length);
    else if (arg === '--pdf') {
      options.pdf = argv[i + 1];
      i += 1;
    } else if (arg.startsWith('--ids=')) {
      options.ids = arg
        .slice('--ids='.length)
        .split(',')
        .map(value => value.trim())
        .filter(Boolean);
    }
  }

  return options;
}

function ensureVisionReady(forceVision) {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('❌ חסר ANTHROPIC_API_KEY ב-backend/.env — Vision לא יכול לרוץ.');
    console.error('   הוסף: ANTHROPIC_API_KEY=sk-ant-...');
    process.exit(2);
  }

  if (forceVision) {
    process.env.PAYSLIP_EXTRACTION_MODE = 'vision';
  }

  if (!isVisionExtractionMode()) {
    console.error('❌ PAYSLIP_EXTRACTION_MODE אינו vision. הוסף ל-.env או הרץ בלי --legacy.');
    process.exit(2);
  }
}

function numClose(actual, expected, tolerance = Math.max(0.01, Math.abs(expected) * 0.005)) {
  if (expected == null || expected === undefined) return { status: 'skip' };
  if (!Number.isFinite(actual)) return { status: 'missing', expected, actual: null };
  return Math.abs(actual - expected) <= tolerance
    ? { status: 'match', expected, actual }
    : { status: 'mismatch', expected, actual };
}

function comparePeriod(actual, expected) {
  if (!expected) return { status: 'skip' };
  if (!actual) return { status: 'missing', expected, actual: null };
  const normalize = value => {
    const str = String(value).trim();
    const yyyymm = str.match(/^(\d{4})-(\d{1,2})$/);
    if (yyyymm) return `${yyyymm[1]}-${yyyymm[2].padStart(2, '0')}`;
    const mmyyyy = str.match(/^(\d{1,2})[/-](\d{4})$/);
    if (mmyyyy) return `${mmyyyy[2]}-${mmyyyy[1].padStart(2, '0')}`;
    return str;
  };
  const norm = normalize(actual);
  const exp = normalize(expected);
  return norm === exp
    ? { status: 'match', expected, actual }
    : { status: 'mismatch', expected, actual };
}

function buildExpectedFlat(expected) {
  return {
    period_month: expected.period?.month ?? null,
    gross_total: expected.salary?.gross_total ?? null,
    net_payable: expected.salary?.net_payable ?? null,
    pension_employee: expected.contributions?.pension?.employee ?? null,
    pension_employer: expected.contributions?.pension?.employer ?? null,
    pension_total: expected.contributions?.pension?.participation_total ?? null,
    study_employee: expected.contributions?.study_fund?.employee ?? null,
    study_employer: expected.contributions?.study_fund?.employer ?? null,
    study_total: expected.contributions?.study_fund?.participation_total ?? null,
  };
}

function buildActualFlat(data) {
  return {
    period_month: data.period?.month ?? null,
    gross_total: data.salary?.gross_total ?? null,
    net_payable: data.salary?.net_payable ?? null,
    pension_employee: data.contributions?.pension?.employee ?? null,
    pension_employer: data.contributions?.pension?.employer ?? null,
    pension_total: data.contributions?.pension?.participation_total ?? null,
    study_employee: data.contributions?.study_fund?.employee ?? null,
    study_employer: data.contributions?.study_fund?.employer ?? null,
    study_total: data.contributions?.study_fund?.participation_total ?? null,
  };
}

function compareExtraction(label, expectedFlat, actualFlat) {
  const rows = [];
  let matches = 0;
  let checks = 0;

  for (const [field, value] of Object.entries(expectedFlat)) {
    if (value == null) continue;
    checks += 1;
    const actual = actualFlat[field];
    const result =
      field === 'period_month'
        ? comparePeriod(actual, value)
        : numClose(actual, value);
    if (result.status === 'match') matches += 1;
    rows.push({ field, ...result });
  }

  return { label, rows, matches, checks, passed: matches === checks && checks > 0 };
}

async function findInputFile(fixtureDir) {
  const entries = await fs.readdir(fixtureDir);
  for (const ext of INPUT_EXTENSIONS) {
    const match = entries.find(name => name.toLowerCase() === `input${ext}`);
    if (match) return path.join(fixtureDir, match);
  }
  return null;
}

async function loadGoldenFixtures({ only }) {
  const entries = await fs.readdir(GOLDEN_DIR, { withFileTypes: true });
  const fixtures = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith('vision-')) continue;
    if (only && !entry.name.includes(only)) continue;

    const fixtureDir = path.join(GOLDEN_DIR, entry.name);
    const expectedPath = path.join(fixtureDir, 'expected.json');
    const inputPath = await findInputFile(fixtureDir);
    if (!inputPath) continue;

    const expected = JSON.parse(await fs.readFile(expectedPath, 'utf8'));
    fixtures.push({ name: entry.name, inputPath, expected });
  }

  return fixtures;
}

async function extractAndReport(label, inputPath, expected = null) {
  const started = Date.now();
  const { data } = await extractPayslipFile(inputPath);
  const latencyMs = Date.now() - started;
  const actualFlat = buildActualFlat(data);
  const method = data.raw?.extractionMethod || 'unknown';
  const confidence = data.quality?.confidence ?? null;

  console.log(`\n=== ${label} ===`);
  console.log(`method=${method} latency=${latencyMs}ms confidence=${confidence}`);
  console.log(
    `pension: employee=${actualFlat.pension_employee} employer=${actualFlat.pension_employer} total=${actualFlat.pension_total}`,
  );
  console.log(
    `study:   employee=${actualFlat.study_employee} employer=${actualFlat.study_employer} total=${actualFlat.study_total}`,
  );

  if (!expected) {
    return { label, data, passed: true, matches: 0, checks: 0 };
  }

  const report = compareExtraction(label, buildExpectedFlat(expected), actualFlat);
  for (const row of report.rows) {
    const icon = row.status === 'match' ? '✓' : row.status === 'skip' ? '·' : '✗';
    console.log(
      `  ${icon} ${row.field}: expected=${row.expected ?? '—'} actual=${row.actual ?? '—'} [${row.status}]`,
    );
  }
  console.log(report.passed ? '→ PASS' : '→ FAIL');
  return { ...report, data };
}

async function reprocessDocuments(ids, write) {
  await connectDB();
  const reports = [];

  for (const id of ids) {
    const document = await Document.findById(id);
    if (!document?.filePath) {
      console.warn(`[skip] document ${id} not found or missing filePath`);
      continue;
    }

    const report = await extractAndReport(
      `${document.originalName} (${id})`,
      document.filePath,
      null,
    );

    if (write) {
      document.analysisData = report.data;
      document.status = 'completed';
      document.processingError = null;
      document.processedAt = new Date();
      await document.save();
      console.log(`  💾 saved to DB (${write ? 'write' : 'dry-run'})`);
    }

    reports.push(report);
  }

  await mongoose.disconnect();
  return reports;
}

async function main() {
  const options = parseArgs(process.argv);
  ensureVisionReady(options.forceVision);

  console.log('Vision payslip eval');
  console.log(`mode=${process.env.PAYSLIP_EXTRACTION_MODE} model=${process.env.PAYSLIP_VISION_MODEL || 'default'}`);

  const reports = [];

  if (options.ids.length) {
    reports.push(...(await reprocessDocuments(options.ids, options.write)));
  } else if (options.pdf) {
    reports.push(await extractAndReport(path.basename(options.pdf), path.resolve(options.pdf)));
  } else {
    const fixtures = await loadGoldenFixtures(options);
    if (!fixtures.length) {
      console.error('No vision golden fixtures found.');
      process.exit(2);
    }
    for (const fixture of fixtures) {
      reports.push(
        await extractAndReport(fixture.name, fixture.inputPath, fixture.expected),
      );
    }
  }

  const scored = reports.filter(r => r.checks > 0);
  const passed = scored.filter(r => r.passed).length;
  console.log(`\nSummary: ${passed}/${scored.length} fixtures passed`);
  process.exit(scored.length && passed === scored.length ? 0 : 1);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
