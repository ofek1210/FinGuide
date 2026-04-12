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

async function main() {
  const options = parseArgs(process.argv.slice(2));
  await connectDB();

  try {
    const documents = await loadDocuments(options);

    if (!documents.length) {
      // eslint-disable-next-line no-console
      console.log('No documents matched the requested reprocessing scope.');
      return;
    }

    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify(
        {
          mode: options.write ? 'write' : 'dry-run',
          count: documents.length,
          ids: options.ids,
          limit: options.limit,
        },
        null,
        2,
      ),
    );

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

        // eslint-disable-next-line no-console
        console.log(JSON.stringify(report, null, 2));
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(
          JSON.stringify(
            {
              id: document._id.toString(),
              originalName: document.originalName,
              error: error.message,
            },
            null,
            2,
          ),
        );
      }
    }
  } finally {
    await mongoose.connection.close();
  }
}

main().catch(error => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
