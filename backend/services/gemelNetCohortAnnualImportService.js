'use strict';

const GemelNetCohortAnnual = require('../models/GemelNetCohortAnnual');
const { parseGemelNetCohortAnnualExcel } = require('./gemelNetCohortAnnualParser');
const { computeGemelCohortAnnualFromCkan } = require('./cohortAnnualComputeService');

async function upsertGemelCohortRows(parsed, opts = {}) {
  if (!parsed.rows.length) {
    return { imported: 0, upserted: 0, modified: 0, warnings: parsed.warnings, meta: parsed.meta };
  }

  const now = new Date();
  let upserted = 0;
  let modified = 0;
  const source = parsed.meta?.source || 'gemelnet_excel';

  for (const row of parsed.rows) {
    const result = await GemelNetCohortAnnual.updateOne(
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

/**
 * Import Gemel-Net cohort annual Excel buffer.
 */
async function importGemelNetCohortAnnualExcel(buffer, opts = {}) {
  const parsed = parseGemelNetCohortAnnualExcel(buffer, opts);
  if (parsed.meta) parsed.meta.source = opts.source || 'gemelnet_excel';
  return upsertGemelCohortRows(parsed, opts);
}

/**
 * Derive cohort annual from CKAN records and persist.
 * @param {object[]} ckanRecords
 */
async function importGemelCohortFromCkan(ckanRecords) {
  const computed = computeGemelCohortAnnualFromCkan(ckanRecords);
  return upsertGemelCohortRows(computed, { sourceFile: 'data.gov.il' });
}

async function getGemelCohortAnnualSummary() {
  return GemelNetCohortAnnual.find({}).sort({ year: -1 }).lean();
}

async function getGemelCohortSyncMeta() {
  const doc = await GemelNetCohortAnnual.findOne({}).sort({ importedAt: -1 }).lean();
  const count = await GemelNetCohortAnnual.countDocuments();
  return {
    rowCount: count,
    lastImportedAt: doc?.importedAt ?? null,
    latestYear: doc?.year ?? null,
    source: doc?.source ?? null,
    reportAsOf: doc?.reportAsOf ?? null,
  };
}

module.exports = {
  importGemelNetCohortAnnualExcel,
  importGemelCohortFromCkan,
  getGemelCohortAnnualSummary,
  getGemelCohortSyncMeta,
};
