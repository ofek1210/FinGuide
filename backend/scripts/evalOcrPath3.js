#!/usr/bin/env node
/* eslint-disable no-console, no-await-in-loop, no-restricted-syntax */
/**
 * Path-3 (image OCR) evaluation on golden fixtures.
 * Rasterizes each PDF via pdftoppm, then runs extractPayslipFile on PNG(s).
 *
 * Usage: node scripts/evalOcrPath3.js [--only=michpal-202210]
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });

const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);

const { extractPayslipFile } = require('../services/payslipOcr');

const GOLDEN_DIR = path.resolve(__dirname, '..', 'services', '__fixtures__', 'golden');
const SKIP = new Set(['_template']);

function parseArgs(argv) {
  const args = { only: null };
  for (const arg of argv.slice(2)) {
    if (arg.startsWith('--only=')) args.only = arg.slice('--only='.length);
  }
  return args;
}

async function rasterizePdf(pdfPath, outDir) {
  const prefix = path.join(outDir, 'page');
  await execFileAsync('pdftoppm', ['-png', '-r', '200', pdfPath, prefix]);
  const files = (await fs.readdir(outDir))
    .filter((f) => f.startsWith('page') && f.endsWith('.png'))
    .sort()
    .map((f) => path.join(outDir, f));
  return files;
}

async function main() {
  const { only } = parseArgs(process.argv);
  const entries = await fs.readdir(GOLDEN_DIR, { withFileTypes: true });
  const results = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || SKIP.has(entry.name)) continue;
    if (only && !entry.name.includes(only)) continue;

    const dir = path.join(GOLDEN_DIR, entry.name);
    const pdfPath = path.join(dir, 'input.pdf');
    try {
      await fs.access(pdfPath);
    } catch {
      continue;
    }

    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), `fg-path3-${entry.name}-`));
    const t0 = Date.now();
    let method = null;
    let gross = null;
    let net = null;
    let err = null;
    try {
      const pngs = await rasterizePdf(pdfPath, tmp);
      if (!pngs.length) throw new Error('pdftoppm produced no PNGs');
      // Multi-page: feed first page only for latency/comparability; Path 3 uses images.
      const result = await extractPayslipFile(pngs[0], { filename: `${entry.name}.png` });
      const data = result.data || result.analysisData || {};
      method = result.extractionMethod || data?.quality?.extraction_path || 'ocr';
      // When input is image, method is always ocr
      if (!method || method === 'pdf_text') method = 'ocr';
      gross = data?.salary?.gross_total ?? null;
      net = data?.salary?.net_payable ?? null;
    } catch (e) {
      err = e.message || String(e);
    } finally {
      await fs.rm(tmp, { recursive: true, force: true }).catch(() => {});
    }
    const ms = Date.now() - t0;
    results.push({
      fixture: entry.name,
      method,
      ms,
      gross,
      net,
      ok: Boolean(gross > 500 && net > 500),
      err,
    });
    console.log(
      `${entry.name}: method=${method} ms=${ms} gross=${gross} net=${net} ok=${Boolean(gross > 500 && net > 500)}${err ? ` ERR=${err}` : ''}`,
    );
  }

  const ok = results.filter((r) => r.ok).length;
  const lat = results.map((r) => r.ms).sort((a, b) => a - b);
  const median = lat.length ? lat[Math.floor(lat.length / 2)] : null;
  console.log('\n=== Path 3 aggregate ===');
  console.log(`  fixtures: ${results.length}`);
  console.log(`  quality-gate pass (gross>500 && net>500): ${ok}/${results.length}`);
  console.log(`  median latency ms: ${median}`);
  console.log(`  min/max ms: ${lat[0]} / ${lat[lat.length - 1]}`);
  console.log(JSON.stringify({ results, ok, median }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
