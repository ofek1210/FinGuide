'use strict';

/**
 * Orchestrates vision payslip extraction: render → extract → sanity → summary.
 *
 * @module services/payslipVisionPipeline
 */

const path = require('path');
const { renderPayslipPages } = require('./payslipPageRenderer');
const { extractPayslipFromImage } = require('./payslipVisionExtractor');
const { runPayslipSanityChecks } = require('./payslipSanityChecks');
const { buildPayslipSummary } = require('./payslipOcrSummary');
const { VISION_CONFIDENCE_THRESHOLD } = require('../config/payslipExtractionConfig');

const OCR_PDF_PAGES_MODE = (process.env.OCR_PDF_PAGES_MODE || 'first').toLowerCase();

function scoreVisionPageResult(result) {
  const data = result?.normalized || {};
  const gross = data.salary?.gross_total;
  const net = data.salary?.net_payable;
  const pension = data.contributions?.pension || {};
  const study = data.contributions?.study_fund || {};
  const conf = result?.raw?.confidence || {};

  let score = 0;
  if (Number.isFinite(gross) && gross >= 8000 && gross <= 80000) score += 4;
  else if (Number.isFinite(gross) && gross >= 3000) score += 1;

  if (Number.isFinite(net) && net >= 3000 && net <= 60000) score += 3;
  if (Number.isFinite(pension.employee) && pension.employee >= 200) score += 2;
  if (Number.isFinite(pension.employer) && pension.employer >= 500) score += 3;
  if (Number.isFinite(study.employee) && study.employee >= 100) score += 1;
  if (Number.isFinite(study.employer) && study.employer >= 300) score += 1;

  score += (conf.salary || 0) + (conf.contributions || 0);
  return score;
}

function mergePageResults(pageResults) {
  if (!pageResults.length) {
    throw new Error('Vision extraction produced no page results.');
  }
  if (pageResults.length === 1) {
    return pageResults[0];
  }

  const scored = pageResults
    .map(result => ({ result, score: scoreVisionPageResult(result) }))
    .sort((a, b) => b.score - a.score);
  return scored[0].result;
}

function applySanityAndSummary(data, audit) {
  const sanity = runPayslipSanityChecks(data);
  data.quality.flaggedInconsistencies = sanity.flaggedInconsistencies;
  if (sanity.warnings.length) {
    data.quality.warnings = [...(data.quality.warnings || []), ...sanity.warnings];
  }

  if (audit) {
    audit.sanityPassed = sanity.passed;
    data.quality.extraction_audit = { ...audit, sanityPassed: sanity.passed };
  }

  const lowConfidence = Object.values(data.quality?.debug?.confidence_groups || {})
    .some(v => Number.isFinite(v) && v < VISION_CONFIDENCE_THRESHOLD);
  if (!sanity.passed || lowConfidence) {
    data.quality.confidence = 'low';
    if (!sanity.passed) {
      data.quality.warnings = [
        ...(data.quality.warnings || []),
        'Sanity checks failed — manual review recommended.',
      ];
    }
  }

  data.summary = buildPayslipSummary(data, '');
  if (data.summary?.taxCreditPoints != null) {
    data.tax = data.tax || {};
    if (data.tax.tax_credit_points == null) {
      data.tax.tax_credit_points = data.summary.taxCreditPoints;
    }
  }
  return data;
}

/**
 * Full vision extraction path — drop-in replacement for legacy extractPayslipFile body.
 *
 * @returns {Promise<{ data: object }>}
 */
async function extractPayslipViaVision(inputPath, { password } = {}) {
  const abs = path.resolve(inputPath);
  const pages = await renderPayslipPages(abs, { password });

  const pagesToProcess =
    OCR_PDF_PAGES_MODE === 'first' && pages.length > 0 ? [pages[0]] : pages;

  const pageResults = [];
  for (const page of pagesToProcess) {
    const result = await extractPayslipFromImage(page.buffer, {
      mimeType: page.mimeType,
      imageSha256: page.sha256,
      pageIndex: page.pageIndex,
      metadataCrop: page.metadataCrop,
      paymentsCrop: page.paymentsCrop,
    });
    pageResults.push(result);
  }

  const best = mergePageResults(pageResults);
  let data = { ...best.normalized };
  data = applySanityAndSummary(data, {
    ...best.audit,
    fromCache: best.fromCache,
    pagesProcessed: pagesToProcess.length,
  });

  data.raw = {
    ...data.raw,
    pages_processed: pagesToProcess.length,
    extractionMethod: 'vision',
  };

  // eslint-disable-next-line no-console
  console.log('[payslipVision] extraction completed', {
    sourcePath: path.basename(abs),
    model: best.audit?.model,
    fromCache: best.fromCache,
    sanityPassed: best.audit?.sanityPassed,
    latencyMs: best.audit?.latencyMs,
    confidence: data.quality?.confidence,
  });

  return { data };
}

module.exports = {
  extractPayslipViaVision,
  applySanityAndSummary,
  mergePageResults,
  scoreVisionPageResult,
};
