'use strict';

const PensiaNetCohortAnnual = require('../models/PensiaNetCohortAnnual');
const { parsePensiaNetCohortAnnualExcel } = require('./pensiaNetCohortAnnualParser');
const { computePensiaCohortAnnualFromCkan } = require('./cohortAnnualComputeService');

/**
 * Import Pensia-Net cohort annual Excel (tsuotHodPtihaRDL.xls).
 * @param {Buffer} buffer
 * @param {{ sourceFile?: string }} [opts]
 */
async function upsertPensiaCohortRows(parsed, opts = {}) {
  if (!parsed.rows.length) {
    return { imported: 0, upserted: 0, modified: 0, warnings: parsed.warnings || [], meta: parsed.meta };
  }

  const now = new Date();
  let upserted = 0;
  let modified = 0;
  const source = parsed.meta?.source || 'pensyanet_excel';

  for (const row of parsed.rows) {
    const result = await PensiaNetCohortAnnual.updateOne(
      { year: row.year, source },
      {
        $set: {
          ...row,
          source,
          sourceFile: opts.sourceFile || parsed.meta?.sourceFile || null,
          reportLabel: parsed.meta?.reportLabel || null,
          reportAsOf: parsed.meta?.reportAsOf || null,
          importedAt: now,
        },
      },
      { upsert: true },
    );
    if (result.upsertedCount) upserted += 1;
    else if (result.modifiedCount) modified += 1;
  }

  return {
    imported: parsed.rows.length,
    upserted,
    modified,
    warnings: parsed.warnings || [],
    meta: parsed.meta,
    rows: parsed.rows,
  };
}

async function importPensiaNetCohortAnnualExcel(buffer, opts = {}) {
  const parsed = parsePensiaNetCohortAnnualExcel(buffer, opts);
  if (parsed.meta) parsed.meta.source = 'pensyanet_excel';
  return upsertPensiaCohortRows(parsed, opts);
}

async function importPensiaCohortFromCkan(ckanRecords) {
  const computed = computePensiaCohortAnnualFromCkan(ckanRecords);
  return upsertPensiaCohortRows(computed, { sourceFile: 'data.gov.il' });
}

async function importPensiaCohortFromCmaBuffer(buffer, opts = {}) {
  const parsed = parsePensiaNetCohortAnnualExcel(buffer, opts);
  if (parsed.meta) parsed.meta.source = 'cma_download';
  return upsertPensiaCohortRows(parsed, opts);
}

async function getCohortAnnualSummary() {
  return PensiaNetCohortAnnual.find({}).sort({ year: -1 }).lean();
}

async function getPensiaCohortSyncMeta() {
  const doc = await PensiaNetCohortAnnual.findOne({}).sort({ importedAt: -1 }).lean();
  const count = await PensiaNetCohortAnnual.countDocuments();
  return {
    rowCount: count,
    lastImportedAt: doc?.importedAt ?? null,
    latestYear: doc?.year ?? null,
    source: doc?.source ?? null,
    reportAsOf: doc?.reportAsOf ?? null,
  };
}

module.exports = {
  importPensiaNetCohortAnnualExcel,
  importPensiaCohortFromCkan,
  importPensiaCohortFromCmaBuffer,
  getCohortAnnualSummary,
  getPensiaCohortSyncMeta,
};
