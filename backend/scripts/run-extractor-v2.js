#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs/promises');
const path = require('path');

const {
  extractPayslipFields,
  validatePayslipExtraction,
  buildCompatibleAnalysisData,
  buildPayslipSummaryV2,
} = require('../services/extraction-v2');

function pretty(obj) {
  return JSON.stringify(obj, null, 2);
}

function printSection(title, payload) {
  console.log(`\n=== ${title} ===`);
  if (typeof payload === 'string') {
    console.log(payload);
    return;
  }
  console.log(pretty(payload));
}

function toAbsoluteInputPath(inputArg) {
  if (!inputArg) {
    return path.join(process.cwd(), 'fixtures', 'extraction-v2', 'sample-valid.json');
  }
  return path.isAbsolute(inputArg) ? inputArg : path.resolve(process.cwd(), inputArg);
}

function buildRawPayload(inputJson) {
  return {
    ocr_engine: inputJson.ocr_engine || 'unknown',
    ocr_lang: inputJson.ocr_lang || 'unknown',
    text_sha256: inputJson.text_sha256 || null,
    rawText: inputJson.rawText || null,
    ocr_text: inputJson.rawText || null,
    extractionMethod: inputJson.extractionMethod || null,
    pages_processed: inputJson.pages_processed ?? null,
    confidence: inputJson.confidence ?? null,
    debug: inputJson.debug || {},
  };
}

function requireValidInputShape(inputJson) {
  if (!inputJson || typeof inputJson !== 'object' || Array.isArray(inputJson)) {
    throw new Error('Input file must contain a JSON object.');
  }

  const hasRawText = typeof inputJson.rawText === 'string' && inputJson.rawText.trim().length > 0;
  const hasRawLines = Array.isArray(inputJson.rawLines) && inputJson.rawLines.length > 0;
  if (!hasRawText && !hasRawLines) {
    throw new Error('Input must include non-empty rawText or non-empty rawLines.');
  }
}

async function run() {
  const inputPath = toAbsoluteInputPath(process.argv[2]);
  const raw = await fs.readFile(inputPath, 'utf8');
  const inputJson = JSON.parse(raw);
  requireValidInputShape(inputJson);

  const extractionInput = {
    rawText: inputJson.rawText || '',
    rawLines: inputJson.rawLines || null,
    extractionMethod: inputJson.extractionMethod || null,
    rawPayload: buildRawPayload(inputJson),
  };

  printSection('Raw Input Overview', {
    inputPath,
    extractionMethod: extractionInput.extractionMethod,
    rawTextLength: extractionInput.rawText.length,
    rawLinesCount: Array.isArray(extractionInput.rawLines) ? extractionInput.rawLines.length : 0,
    ocrMeta: {
      ocr_engine: inputJson.ocr_engine || null,
      ocr_lang: inputJson.ocr_lang || null,
      pages_processed: inputJson.pages_processed ?? null,
    },
  });

  const extractionResult = await extractPayslipFields(extractionInput);
  const validationResult = validatePayslipExtraction({ extractionResult });
  const analysisData = buildCompatibleAnalysisData({
    rawPayload: extractionInput.rawPayload,
    extractionResult,
    validationResult,
  });
  const summary = buildPayslipSummaryV2(analysisData);

  printSection('Extracted Critical Fields', extractionResult.fields);
  printSection('Validation Result', validationResult);
  printSection('Compatibility analysisData (summary section)', analysisData.summary);
  printSection('Compatibility analysisData (quality section)', analysisData.quality);
  printSection('Summary (standalone adapter output)', summary);

  const issues = [
    ...(validationResult.warnings || []),
    ...(validationResult.errors || []),
  ];
  printSection('Warnings / Errors', issues.length ? issues : 'No warnings or errors.');
}

run().catch((error) => {
  console.error('\nExtractor v2 debug runner failed.');
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
