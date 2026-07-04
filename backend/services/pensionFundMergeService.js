/**
 * Merge pension funds from multiple import sources (har_hakesef, quarterly_report, manual).
 */
'use strict';

const PensionFund = require('../models/PensionFund');
const { norm, upsertImportedRecords } = require('./importMergeService');

const SOURCE_PRIORITY = {
  clearinghouse: 4,
  quarterly_report: 3,
  har_hakesef: 2,
  free_report: 1,
  manual: 0,
};

function fundMergeKey(fund) {
  const provider = norm(fund.provider);
  const account = norm(fund.accountNumber);
  if (provider && account) return `${provider}::acc::${account}`;
  const name = norm(fund.fundName);
  if (provider && name) return `${provider}::name::${name}`;
  return `name::${name}`;
}

function pickBetter(existingVal, incomingVal, preferIncoming) {
  if (incomingVal == null || incomingVal === '') return existingVal ?? null;
  if (existingVal == null || existingVal === '') return incomingVal;
  return preferIncoming ? incomingVal : existingVal;
}

function mergeFundRecord(existing, incoming, importSource) {
  const existingPri = SOURCE_PRIORITY[existing.source] || 0;
  const incomingPri = SOURCE_PRIORITY[importSource] || 0;
  const preferIncoming = incomingPri >= existingPri;

  const merged = {
    fundName: pickBetter(existing.fundName, incoming.fundName, preferIncoming) || incoming.fundName,
    fundType: pickBetter(existing.fundType, incoming.fundType, preferIncoming) || incoming.fundType,
    provider: pickBetter(existing.provider, incoming.provider, preferIncoming),
    accountNumber: pickBetter(existing.accountNumber, incoming.accountNumber, true),
    currentBalance: pickBetter(existing.currentBalance, incoming.currentBalance, preferIncoming),
    monthlyEmployeeDeposit: pickBetter(existing.monthlyEmployeeDeposit, incoming.monthlyEmployeeDeposit, preferIncoming),
    monthlyEmployerDeposit: pickBetter(existing.monthlyEmployerDeposit, incoming.monthlyEmployerDeposit, preferIncoming),
    managementFeeAccumulation: pickBetter(
      existing.managementFeeAccumulation,
      incoming.managementFeeAccumulation,
      importSource === 'quarterly_report' || preferIncoming,
    ),
    managementFeeDeposit: pickBetter(
      existing.managementFeeDeposit,
      incoming.managementFeeDeposit,
      importSource === 'quarterly_report' || preferIncoming,
    ),
    investmentTrack: pickBetter(
      existing.investmentTrack,
      incoming.investmentTrack,
      importSource === 'quarterly_report' || preferIncoming,
    ),
    riskLevel: pickBetter(existing.riskLevel, incoming.riskLevel, preferIncoming),
    ytdReturn: pickBetter(existing.ytdReturn, incoming.ytdReturn, preferIncoming),
    activityStatus: pickBetter(existing.activityStatus, incoming.activityStatus, preferIncoming),
    insuranceCoverages: incoming.insuranceCoverages?.length
      ? incoming.insuranceCoverages
      : (existing.insuranceCoverages || []),
    status: preferIncoming
      ? (incoming.status ?? existing.status ?? 'active')
      : (existing.status ?? incoming.status ?? 'active'),
    isActive: preferIncoming
      ? incoming.isActive !== false
      : existing.isActive !== false,
    source: existing.source === 'manual' && importSource !== 'manual' ? existing.source : importSource,
    sourceFile: incoming.sourceFile || existing.sourceFile,
    rawData: incoming.rawData || existing.rawData,
    lastUpdated: new Date(),
  };

  if (existing.source === 'manual' && importSource !== 'manual') {
    merged.source = existing.source;
  } else if (importSource !== 'manual') {
    merged.source = importSource;
  }

  return merged;
}

/**
 * Upsert imported funds; remove stale records for same import source only.
 * Manual funds are never deleted.
 */
async function upsertImportedFunds(userId, parsedFunds, importSource, sourceFile) {
  const result = await upsertImportedRecords({
    Model: PensionFund,
    userId,
    items: parsedFunds,
    mergeKeyFn: fundMergeKey,
    buildCreatePayload: incoming => ({
      ...incoming,
      user: userId,
      source: importSource,
      sourceFile,
      lastUpdated: new Date(),
    }),
    mergeRecordFn: (existing, payload) => mergeFundRecord(existing, payload, importSource),
    findStale: (record, importKeys) =>
      record.source === importSource && !importKeys.has(fundMergeKey(record)),
    listFilter: { status: { $ne: 'closed' } },
  });

  return {
    funds: result.records,
    imported: result.imported,
    merged: result.merged,
    created: result.created,
  };
}

module.exports = {
  fundMergeKey,
  mergeFundRecord,
  upsertImportedFunds,
  norm,
};
