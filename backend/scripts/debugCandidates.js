#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * One-off diagnostic: load a payslip PDF, run extraction, and dump the
 * candidate store for the requested fields. Used to debug why a real value
 * (e.g. malam-plus-202512: ni=42.35) never enters the candidate store.
 *
 * Usage:
 *   node scripts/debugCandidates.js <input.pdf> [field,field,...]
 *
 * Default fields: gross_total, net_payable, mandatory_total,
 *                 national_insurance, health_insurance, income_tax
 */

const fs = require('fs/promises');
const path = require('path');

const { buildNormalizedOcrDocumentFromSource } = require('../services/payslipOcrContext');
const { collectCoreFieldCandidates } = require('../services/payslipOcrResolver');

let pdfParse;

async function loadPdfText(pdfPath) {
  if (!pdfParse) pdfParse = require('pdf-parse');
  const buffer = await fs.readFile(pdfPath);
  const result = await pdfParse(buffer);
  return result.text || '';
}

function fmtCandidate(c) {
  return `${String(c.value).padStart(12)}  score=${c.score.toFixed(2)}  src=${c.source.padEnd(22)} line=${c.lineIndex ?? '?'}  ${c.reason || ''}`;
}

async function run() {
  const inputArg = process.argv[2];
  if (!inputArg) {
    console.error('Usage: node scripts/debugCandidates.js <input.pdf> [field,field,...]');
    process.exit(2);
  }
  const fieldsArg = process.argv[3];
  const requestedFields = fieldsArg
    ? fieldsArg.split(',').map(s => s.trim()).filter(Boolean)
    : ['gross_total', 'net_payable', 'mandatory_total',
       'national_insurance', 'health_insurance', 'income_tax'];

  const pdfPath = path.resolve(process.cwd(), inputArg);
  const text = await loadPdfText(pdfPath);
  console.log(`Loaded ${pdfPath} (${text.length} chars)\n`);

  const normalizedDoc = buildNormalizedOcrDocumentFromSource(text);
  const store = collectCoreFieldCandidates(normalizedDoc);

  for (const field of requestedFields) {
    const candidates = store[field] || [];
    console.log(`=== ${field} (${candidates.length} candidates) ===`);
    const sorted = [...candidates].sort((a, b) => b.score - a.score);
    for (const c of sorted) console.log('  ' + fmtCandidate(c));
    console.log();
  }

  console.log('=== Raw lines around interesting labels ===');
  const wantedLabels = [
    /ביטוח\s*לאומי/, /ביטוח\s*בריאות/, /ניכויי\s*חובה/,
    /סכום\s*בבנק/, /סך\s*תשלומים/, /קוד\s*ב\.?\s*לאומי/,
  ];
  normalizedDoc.lines.forEach((entry, i) => {
    if (wantedLabels.some(rx => rx.test(entry.raw))) {
      const ctx = normalizedDoc.lines.slice(Math.max(0, i - 1), Math.min(normalizedDoc.lines.length, i + 2));
      console.log(`L${i.toString().padStart(3)}: ${entry.raw}`);
      ctx.forEach((c, j) => {
        if (c.index !== i) console.log(`      → L${c.index.toString().padStart(3)}: ${c.raw}`);
      });
    }
  });
}

run().catch(error => {
  console.error(error);
  process.exit(1);
});
