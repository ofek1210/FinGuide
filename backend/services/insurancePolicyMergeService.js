'use strict';

const InsurancePolicy = require('../models/InsurancePolicy');
const { norm, upsertImportedRecords } = require('./importMergeService');

function policyMergeKey(policy) {
  const provider = norm(policy.provider);
  const num = norm(policy.policyNumber);
  if (provider && num) return `${provider}::num::${num}`;
  const type = norm(policy.type);
  if (provider && type) return `${provider}::type::${type}`;
  return `type::${type}::${provider}`;
}

const IMPORT_SOURCE = 'har_bituach';

function mergePolicyRecord(existing, incoming) {
  return {
    type: incoming.type || existing.type,
    provider: incoming.provider ?? existing.provider,
    policyNumber: incoming.policyNumber ?? existing.policyNumber,
    monthlyPremium: incoming.monthlyPremium ?? existing.monthlyPremium,
    coverageAmount: incoming.coverageAmount ?? existing.coverageAmount,
    startDate: incoming.startDate ?? existing.startDate,
    endDate: incoming.endDate ?? existing.endDate,
    status: incoming.status || existing.status || 'active',
    source: incoming.source || existing.source || IMPORT_SOURCE,
    sourceFile: incoming.sourceFile || existing.sourceFile,
    rawData: incoming.rawData || existing.rawData,
  };
}

async function upsertImportedPolicies(userId, parsedPolicies, sourceFile) {
  const result = await upsertImportedRecords({
    Model: InsurancePolicy,
    userId,
    items: parsedPolicies,
    mergeKeyFn: policyMergeKey,
    buildCreatePayload: incoming => ({
      ...incoming,
      user: userId,
      sourceFile,
      source: IMPORT_SOURCE,
    }),
    mergeRecordFn: mergePolicyRecord,
    findStale: (record, importKeys) =>
      record.source === IMPORT_SOURCE && !importKeys.has(policyMergeKey(record)),
    listFilter: { status: { $ne: 'cancelled' } },
  });

  return {
    policies: result.records,
    imported: result.imported,
    merged: result.merged,
    created: result.created,
  };
}

module.exports = { policyMergeKey, mergePolicyRecord, upsertImportedPolicies, norm, IMPORT_SOURCE };
