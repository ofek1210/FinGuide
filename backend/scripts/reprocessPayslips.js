#!/usr/bin/env node
require('dotenv').config();

const mongoose = require('mongoose');

const connectDB = require('../config/db');
const Document = require('../models/Document');
const { extractPayslipFile } = require('../services/payslipOcr');

function parseArgs(argv) {
  const options = {
    ids: [],
    limit: 20,
    write: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--ids') {
      const raw = argv[index + 1] || '';
      options.ids = raw
        .split(',')
        .map(value => value.trim())
        .filter(Boolean);
      index += 1;
      continue;
    }

    if (arg === '--limit') {
      const value = Number(argv[index + 1]);
      if (Number.isFinite(value) && value > 0) {
        options.limit = value;
      }
      index += 1;
      continue;
    }

    if (arg === '--write') {
      options.write = true;
    }
  }

  return options;
}

function buildResolvedFieldsSummary(data) {
  if (!data || typeof data !== 'object') {
    return {};
  }

  return {
    period_month: data.period?.month ?? null,
    gross_total: data.salary?.gross_total ?? null,
    net_payable: data.salary?.net_payable ?? null,
    mandatory_total: data.deductions?.mandatory?.total ?? null,
    income_tax: data.deductions?.mandatory?.income_tax ?? null,
    national_insurance: data.deductions?.mandatory?.national_insurance ?? null,
    health_insurance: data.deductions?.mandatory?.health_insurance ?? null,
    employee_name: data.parties?.employee_name ?? null,
    employee_id: data.parties?.employee_id ?? null,
    employer_name: data.parties?.employer_name ?? null,
    pension_employee: data.contributions?.pension?.employee ?? null,
    pension_employer: data.contributions?.pension?.employer ?? null,
    study_employee: data.contributions?.study_fund?.employee ?? null,
    study_employer: data.contributions?.study_fund?.employer ?? null,
  };
}

function diffWarnings(oldWarnings = [], newWarnings = []) {
  return {
    added: newWarnings.filter(warning => !oldWarnings.includes(warning)),
    removed: oldWarnings.filter(warning => !newWarnings.includes(warning)),
  };
}

function buildReport(document, nextAnalysisData) {
  const current = document.analysisData || {};
  const next = nextAnalysisData || {};

  return {
    id: document._id.toString(),
    originalName: document.originalName,
    dryRun: true,
    old: {
      schema_version: current.schema_version ?? null,
      confidence: current.quality?.confidence ?? null,
      resolution_score: current.quality?.resolution_score ?? null,
      resolved_core_fields: current.quality?.resolved_core_fields ?? null,
      resolved_fields: buildResolvedFieldsSummary(current),
    },
    next: {
      schema_version: next.schema_version ?? null,
      confidence: next.quality?.confidence ?? null,
      resolution_score: next.quality?.resolution_score ?? null,
      resolved_core_fields: next.quality?.resolved_core_fields ?? null,
      resolved_fields: buildResolvedFieldsSummary(next),
    },
    warnings_delta: diffWarnings(current.quality?.warnings || [], next.quality?.warnings || []),
  };
}

function initializeAggregateReport() {
  return {
    documents: 0,
    schema_version_changes: {},
    average_confidence_delta: 0,
    average_resolution_delta: 0,
    field_coverage_delta: {},
    warning_counts: {
      added: {},
      removed: {},
    },
  };
}

function incrementCounter(store, key) {
  if (!key) return;
  store[key] = (store[key] || 0) + 1;
}

function buildAggregateReport(reports = []) {
  const aggregate = initializeAggregateReport();

  if (!reports.length) {
    return aggregate;
  }

  let confidenceDeltaSum = 0;
  let resolutionDeltaSum = 0;

  for (const report of reports) {
    aggregate.documents += 1;

    const schemaKey = `${report.old.schema_version ?? 'null'}->${report.next.schema_version ?? 'null'}`;
    incrementCounter(aggregate.schema_version_changes, schemaKey);

    confidenceDeltaSum += (report.next.confidence || 0) - (report.old.confidence || 0);
    resolutionDeltaSum += (report.next.resolution_score || 0) - (report.old.resolution_score || 0);

    const allFields = new Set([
      ...Object.keys(report.old.resolved_fields || {}),
      ...Object.keys(report.next.resolved_fields || {}),
    ]);

    allFields.forEach(field => {
      const oldPresent = report.old.resolved_fields?.[field] !== null && report.old.resolved_fields?.[field] !== undefined;
      const nextPresent = report.next.resolved_fields?.[field] !== null && report.next.resolved_fields?.[field] !== undefined;
      const delta = (nextPresent ? 1 : 0) - (oldPresent ? 1 : 0);
      aggregate.field_coverage_delta[field] = (aggregate.field_coverage_delta[field] || 0) + delta;
    });

    report.warnings_delta.added.forEach(warning => incrementCounter(aggregate.warning_counts.added, warning));
    report.warnings_delta.removed.forEach(warning => incrementCounter(aggregate.warning_counts.removed, warning));
  }

  aggregate.average_confidence_delta = Number((confidenceDeltaSum / reports.length).toFixed(4));
  aggregate.average_resolution_delta = Number((resolutionDeltaSum / reports.length).toFixed(4));

  return aggregate;
}

async function loadDocuments(options) {
  if (options.ids.length > 0) {
    return Document.find({ _id: { $in: options.ids } })
      .sort({ uploadedAt: -1 })
      .exec();
  }

  return Document.find({ status: 'completed' })
    .sort({ uploadedAt: -1 })
    .limit(options.limit)
    .exec();
}

async function runReprocess(options) {
  await connectDB();

  try {
    const documents = await loadDocuments(options);

    if (!documents.length) {
      return {
        meta: {
          mode: options.write ? 'write' : 'dry-run',
          count: 0,
          ids: options.ids,
          limit: options.limit,
        },
        reports: [],
        aggregate: initializeAggregateReport(),
      };
    }

    const reports = [];

    for (const document of documents) {
      try {
        const { data } = await extractPayslipFile(document.filePath);
        const report = buildReport(document, data);
        report.dryRun = !options.write;

        if (options.write) {
          document.analysisData = data;
          document.status = 'completed';
          document.processingError = null;
          document.processedAt = new Date();
          await document.save();
        }

        reports.push(report);
      } catch (error) {
        reports.push({
          id: document._id.toString(),
          originalName: document.originalName,
          error: error.message,
        });
      }
    }

    return {
      meta: {
        mode: options.write ? 'write' : 'dry-run',
        count: documents.length,
        ids: options.ids,
        limit: options.limit,
      },
      reports,
      aggregate: buildAggregateReport(reports.filter(report => !report.error)),
    };
  } finally {
    await mongoose.connection.close();
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const result = await runReprocess(options);

  // eslint-disable-next-line no-console
  console.log(JSON.stringify(result.meta, null, 2));

  for (const report of result.reports) {
    if (report.error) {
      // eslint-disable-next-line no-console
      console.error(JSON.stringify(report, null, 2));
      continue;
    }

    // eslint-disable-next-line no-console
    console.log(JSON.stringify(report, null, 2));
  }

  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ aggregate: result.aggregate }, null, 2));
}

if (require.main === module) {
  main().catch(error => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
  });
}

module.exports = {
  buildAggregateReport,
  buildReport,
  buildResolvedFieldsSummary,
  diffWarnings,
  initializeAggregateReport,
  parseArgs,
  runReprocess,
};
