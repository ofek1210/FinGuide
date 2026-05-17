#!/usr/bin/env node
/* eslint-disable no-console, no-await-in-loop */

/**
 * Split a multi-page payslip PDF into one PDF per page, written as input.pdf
 * inside a sibling fixture directory.
 *
 * Usage:
 *   node scripts/splitPayslipPdf.js <input.pdf> <vendor-prefix>
 *
 * Example:
 *   node scripts/splitPayslipPdf.js \
 *     services/__fixtures__/golden/michpal-202209/input.pdf michpal-2022
 *
 *   -> creates michpal-2022-p1/input.pdf, michpal-2022-p2/input.pdf, ...
 *      in the same parent directory.
 *
 * If a target dir already contains input.pdf, the script aborts to avoid
 * overwriting hand-curated fixtures.
 */

const fs = require('fs/promises');
const path = require('path');
const { PDFDocument } = require('pdf-lib');

async function run() {
  const [, , inputArg, prefixArg] = process.argv;
  if (!inputArg || !prefixArg) {
    console.error('Usage: node scripts/splitPayslipPdf.js <input.pdf> <vendor-prefix>');
    process.exit(2);
  }

  const inputPath = path.resolve(process.cwd(), inputArg);
  const parentDir = path.dirname(path.dirname(inputPath));
  const buffer = await fs.readFile(inputPath);
  const source = await PDFDocument.load(buffer);
  const pageCount = source.getPageCount();
  console.log(`Loaded ${inputPath} (${pageCount} pages)`);

  for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
    const target = await PDFDocument.create();
    const [copiedPage] = await target.copyPages(source, [pageIndex]);
    target.addPage(copiedPage);

    const pageLabel = `${prefixArg}-p${pageIndex + 1}`;
    const targetDir = path.join(parentDir, pageLabel);
    const targetFile = path.join(targetDir, 'input.pdf');

    await fs.mkdir(targetDir, { recursive: true });

    try {
      await fs.access(targetFile);
      console.log(`  [skip] ${pageLabel}/input.pdf already exists`);
      continue;
    } catch {
      // file does not exist — proceed
    }

    const bytes = await target.save();
    await fs.writeFile(targetFile, bytes);
    console.log(`  wrote ${pageLabel}/input.pdf (${bytes.length} bytes)`);
  }
}

run().catch(error => {
  console.error(error);
  process.exit(1);
});
