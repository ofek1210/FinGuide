'use strict';

const PensiaNetCohortAnnual = require('../models/PensiaNetCohortAnnual');
const { parsePensiaNetCohortAnnualExcel } = require('./pensiaNetCohortAnnualParser');

/**
 * Import Pensia-Net cohort annual Excel (tsuotHodPtihaRDL.xls).
 * @param {Buffer} buffer
 * @param {{ sourceFile?: string }} [opts]
 */
async function importPensiaNetCohortAnnualExcel(buffer, opts = {}) {
  const parsed = parsePensiaNetCohortAnnualExcel(buffer, opts);
  if (!parsed.rows.length) {
    return { imported: 0, warnings: parsed.warnings, meta: parsed.meta };
  }

  const now = new Date();
  let upserted = 0;
  let modified = 0;

  for (const row of parsed.rows) {
    const result = await PensiaNetCohortAnnual.updateOne(
      { year: row.year, source: 'pensyanet_excel' },
      {
        $set: {
          ...row,
          source: 'pensyanet_excel',
          sourceFile: opts.sourceFile || parsed.meta.sourceFile || null,
          reportLabel: parsed.meta.reportLabel,
          reportAsOf: parsed.meta.reportAsOf,
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
    warnings: parsed.warnings,
    meta: parsed.meta,
    rows: parsed.rows,
  };
}

async function getCohortAnnualSummary() {
  return PensiaNetCohortAnnual.find({ source: 'pensyanet_excel' }).sort({ year: -1 }).lean();
}

module.exports = { importPensiaNetCohortAnnualExcel, getCohortAnnualSummary };
