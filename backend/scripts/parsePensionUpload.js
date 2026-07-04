#!/usr/bin/env node
'use strict';

/**
 * Preview pension Excel parse output — same shape as the upload API (without DB write).
 *
 * Usage:
 *   node scripts/parsePensionUpload.js "<path-to.xls|.xlsx>"
 *   node scripts/parsePensionUpload.js "<path>" --out backend/.work/parse-preview.json
 *   node scripts/parsePensionUpload.js "<path>" --mode preview   # Option A free preview
 *   node scripts/parsePensionUpload.js "<path>" --mode clearinghouse (default)
 *
 * Write output under backend/.work/ (gitignored) — not repo root (may contain PII).
 */
const fs = require('fs');
const path = require('path');
const { parseClearinghouseExcel, isClearinghouseWorkbook } = require('../services/pensionClearinghouseParser');
const { parsePensionFreeReport } = require('../services/pensionFreeReportParser');
const { parseHarHaKesef } = require('../services/harHaKesefService');

function mapPensionFundToDto(f) {
  return {
    id: f._id?.toString?.() ?? f.id ?? null,
    fundName: f.fundName,
    fundType: f.fundType,
    provider: f.provider,
    accountNumber: f.accountNumber ?? null,
    currentBalance: f.currentBalance,
    monthlyEmployeeDeposit: f.monthlyEmployeeDeposit ?? null,
    monthlyEmployerDeposit: f.monthlyEmployerDeposit ?? null,
    managementFeeAccumulation: f.managementFeeAccumulation,
    managementFeeDeposit: f.managementFeeDeposit,
    ytdReturn: f.ytdReturn ?? null,
    investmentTrack: f.investmentTrack ?? null,
    activityStatus: f.activityStatus ?? null,
    status: f.status,
    isActive: f.isActive,
    insuranceCoverages: f.insuranceCoverages ?? [],
    deposits: f.deposits ?? [],
    source: f.source ?? null,
  };
}

function buildClearinghouseResponse(parsed, fileName) {
  const active = parsed.funds.filter(f => f.isActive);
  const inactive = parsed.funds.filter(f => !f.isActive);

  return {
    success: true,
    message: parsed.funds.length
      ? `נפרסו ${parsed.funds.length} קרנות (תצוגה מקדימה — ללא שמירה ל-DB)`
      : 'לא זוהו קרנות בקובץ',
    data: {
      mode: 'clearinghouse',
      sourceFile: fileName,
      imported: parsed.funds.length,
      depositsSaved: parsed.deposits?.length ?? 0,
      warnings: parsed.summary?.parseWarnings ?? [],
      summary: parsed.summary,
      funds: parsed.funds.map(f => mapPensionFundToDto(f)),
      narrative: active.length
        ? `לפי הממצאים: זוהו ${active.length} מוצרים פעילים${inactive.length ? ` ו-${inactive.length} לא פעילים` : ''}.`
        : 'לא זוהו מוצרים פעילים.',
    },
  };
}

function buildFreePreviewResponse(parsed, fileName) {
  const active = parsed.funds.filter(f => f.isActive);
  const inactive = parsed.funds.filter(f => !f.isActive);

  return {
    success: true,
    data: {
      mode: 'free_preview',
      sourceFile: fileName,
      sourceKind: parsed.sourceKind,
      funds: parsed.funds,
      summary: parsed.summary,
      narrative: active.length
        ? `לפי הממצאים: זוהו ${active.length} מוצרים פעילים${inactive.length ? ` ו-${inactive.length} לא פעילים` : ''}.`
        : 'לא זוהו מוצרים פעילים — ניתן להזין ידנית.',
    },
  };
}

async function parseFile(buffer, filePath, mode) {
  const ext = path.extname(filePath).toLowerCase();
  const fileName = path.basename(filePath);

  if (mode === 'clearinghouse' || (mode === 'auto' && isClearinghouseWorkbook(buffer))) {
    const parsed = parseClearinghouseExcel(buffer);
    return buildClearinghouseResponse(parsed, fileName);
  }

  if (mode === 'preview' || mode === 'free') {
    const parsed = parsePensionFreeReport(buffer, { ext, originalName: fileName });
    return buildFreePreviewResponse(parsed, fileName);
  }

  const parsed = await parseHarHaKesef(buffer, { ext, originalName: fileName });
  return {
    success: true,
    data: {
      mode: 'har_hakesef',
      sourceFile: fileName,
      funds: parsed.funds,
      summary: parsed.summary,
    },
  };
}

async function main() {
  const args = process.argv.slice(2).filter(a => a !== '--');
  const filePath = args.find(a => !a.startsWith('--'));
  const outIdx = args.indexOf('--out');
  const outPath = outIdx >= 0 ? args[outIdx + 1] : null;
  const modeArg = args.find(a => a.startsWith('--mode='));
  const mode = modeArg ? modeArg.split('=')[1] : (args.includes('--preview') ? 'preview' : 'auto');

  if (!filePath) {
    console.error('Usage: node scripts/parsePensionUpload.js "<file.xls|xlsx>" [--out output.json] [--mode=clearinghouse|preview|auto]');
    process.exit(1);
  }

  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    console.error(`File not found: ${resolved}`);
    process.exit(1);
  }

  const buffer = fs.readFileSync(resolved);
  const result = await parseFile(buffer, resolved, mode);
  const json = JSON.stringify(result, null, 2);

  if (outPath) {
    fs.writeFileSync(path.resolve(outPath), json, 'utf8');
    console.error(`Written to ${path.resolve(outPath)}`);
  } else {
    console.log(json);
  }
}

main().catch(err => {
  console.error(err.message || err);
  process.exit(1);
});
