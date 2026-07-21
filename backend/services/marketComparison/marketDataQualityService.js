'use strict';

const { normalizeExposurePercent } = require('../../utils/normalizePercentage');
const { classifyGemelNetProduct } = require('./productClassificationService');
const { classifyRisk } = require('./riskClassificationService');
const { classifyComparisonGroup, UNCLASSIFIED_GROUP } = require('./comparisonGroupService');
const { applyRiskGroupCompatibility } = require('./riskGroupCompatibilityService');

const STALE_SYNC_DAYS = 45;

function emptyCountMap(keys) {
  return Object.fromEntries(keys.map((key) => [key, 0]));
}

function hasValidReturn(record) {
  return ['return12Months', 'return36MonthsAnnualized', 'return5YearsAnnualized'].some(
    (field) => record[field] != null && Number.isFinite(record[field]),
  );
}

function countReturns(records) {
  const counts = {
    missingReturn12Months: 0,
    missingReturn36MonthsAnnualized: 0,
    missingReturn5YearsAnnualized: 0,
  };

  for (const record of records) {
    if (record.return12Months == null) counts.missingReturn12Months += 1;
    if (record.return36MonthsAnnualized == null) counts.missingReturn36MonthsAnnualized += 1;
    if (record.return5YearsAnnualized == null) counts.missingReturn5YearsAnnualized += 1;
  }

  return counts;
}

function countByField(records, field) {
  const map = {};
  for (const record of records) {
    const key = record[field] || 'unclassified';
    map[key] = (map[key] || 0) + 1;
  }
  return map;
}

function detectDuplicateFundIds(records) {
  const seen = new Set();
  let duplicates = 0;
  for (const record of records) {
    if (!record.fundId) continue;
    if (seen.has(record.fundId)) duplicates += 1;
    seen.add(record.fundId);
  }
  return duplicates;
}

function isStaleRecord(record, referenceDate = new Date()) {
  if (!record.lastSyncedAt) return true;
  const syncedAt = new Date(record.lastSyncedAt);
  const ageDays = (referenceDate - syncedAt) / (1000 * 60 * 60 * 24);
  return ageDays > STALE_SYNC_DAYS;
}

function deriveQualityLevel({ eligibleRecords, rankedRecords, staleRecords, totalRecords }) {
  if (totalRecords === 0) return 'low';
  const eligibleRatio = eligibleRecords / totalRecords;
  const rankedRatio = rankedRecords / Math.max(eligibleRecords, 1);
  if (eligibleRatio >= 0.7 && rankedRatio >= 0.6 && staleRecords === 0) return 'high';
  if (eligibleRatio >= 0.5 && rankedRatio >= 0.4) return 'medium';
  return 'low';
}

function buildNormalizedRecord(row, {
  productType,
  isPublicProduct,
  domain,
  source,
}) {
  const stockExposure = normalizeExposurePercent(row.CHSHIF_MNUIOT, row.YITRAT_NECHASIM);
  const enriched = {
    ...row,
    stockExposurePct: stockExposure.value,
  };

  const group = classifyComparisonGroup(enriched, { productType, domain });
  const risk = classifyRisk(enriched, { domain, comparisonGroup: group.comparisonGroup });

  const base = {
    fundId: row.ID ? String(row.ID) : null,
    fundName: row.SHM_KRN || null,
    managingCompany: row.SHM_TAAGID_MENAEL || row.SHM_TAAGID_SHOLET || null,
    productType,
    isPublicProduct,
    riskLevel: risk.riskLevel,
    riskReason: risk.reason,
    comparisonGroup: group.comparisonGroup,
    comparisonGroupReason: group.reason,
    specialization: row.SPECIALIZATION || null,
    subSpecialization: row.SUB_SPECIALIZATION || null,
    return12Months: row.TSUA_12_HODASHIM ?? null,
    return36MonthsAnnualized: row.TSUA_36_HODASHIM ?? null,
    return5YearsAnnualized: row.TSUA_SHNATIT_MEMUZAAT_5_SHANIM ?? null,
    assetsUnderManagement: row.YITRAT_NECHASIM ?? null,
    managementFeeBalance: row.SHIUR_D_NIHUL_AHARON_TTVURAH ?? row.SHIUR_D_NIHUL_MEANUAL ?? null,
    managementFeeDeposit: row.SHIUR_D_NIHUL_AHARON_HAFKADOT ?? null,
    reportPeriod: row.TKUFAT_DUACH ?? null,
    lastSyncedAt: row.syncedAt ?? null,
    source,
    stockExposurePct: stockExposure.value,
  };

  return applyRiskGroupCompatibility(base);
}

function normalizeGemelNetRow(row) {
  const productClassification = classifyGemelNetProduct(row);
  return buildNormalizedRecord(row, {
    productType: productClassification.productType,
    isPublicProduct: productClassification.isPublicLeaderboard,
    domain: 'gemel',
    source: 'gemelnet',
  });
}

function normalizePensiaNetRow(row) {
  return buildNormalizedRecord(row, {
    productType: 'pension',
    isPublicProduct: true,
    domain: 'pension',
    source: 'pensianet',
  });
}

function isEligibleForRanking(record, { period = 'combined', risk = null, comparisonGroup = null } = {}) {
  if (!record.isPublicProduct) return false;
  if (!record.fundId || !record.fundName || !record.managingCompany) return false;
  if (record.riskLevel === 'unclassified') return false;
  if (record.comparisonGroup === UNCLASSIFIED_GROUP) return false;
  if (record.riskGroupCompatible === false) return false;
  if (risk && record.riskLevel !== risk) return false;
  if (comparisonGroup && record.comparisonGroup !== comparisonGroup) return false;
  if (!hasValidReturn(record)) return false;

  if (period === 'combined') {
    const available = [
      record.return12Months,
      record.return36MonthsAnnualized,
      record.return5YearsAnnualized,
    ].filter((value) => value != null && Number.isFinite(value));
    return available.length >= 2;
  }

  const fieldMap = {
    '12': 'return12Months',
    '36': 'return36MonthsAnnualized',
    '5y': 'return5YearsAnnualized',
  };
  const field = fieldMap[period];
  return field ? record[field] != null && Number.isFinite(record[field]) : false;
}

function buildMarketDataQuality(records, {
  product = null,
  source = 'unknown',
  latestReportPeriod = null,
  lastUpdated = null,
  riskGroupContradictions = 0,
} = {}) {
  const scoped = product ? records.filter((record) => record.productType === product) : records;

  const excludedProductCounts = emptyCountMap(['child_savings', 'central_severance', 'unknown']);
  for (const record of records) {
    if (excludedProductCounts[record.productType] != null) {
      excludedProductCounts[record.productType] += 1;
    }
  }

  const eligibleRecords = scoped.filter((record) =>
    isEligibleForRanking(record, { period: 'combined' }),
  );

  const staleRecords = scoped.filter((record) => isStaleRecord(record)).length;

  const returnCounts = countReturns(scoped);
  const riskCounts = countByField(scoped, 'riskLevel');
  const groupCounts = countByField(scoped, 'comparisonGroup');

  const unclassifiedRiskRecords = riskCounts.unclassified || 0;
  const unclassifiedComparisonGroupRecords = groupCounts.unclassified || 0;

  const insufficientHistoryRecords = scoped.filter((record) => {
    if (!record.isPublicProduct) return false;
    const available = [
      record.return12Months,
      record.return36MonthsAnnualized,
      record.return5YearsAnnualized,
    ].filter((value) => value != null && Number.isFinite(value));
    return available.length < 2;
  }).length;

  return {
    source,
    lastUpdated,
    latestOfficialReportPeriod: latestReportPeriod,
    totalRecords: records.length,
    productRecords: scoped.length,
    publicProductRecords: records.filter((record) => record.isPublicProduct).length,
    eligibleRecords: eligibleRecords.length,
    rankedRecords: 0,
    excludedRecords: scoped.length - eligibleRecords.length,
    unclassifiedRiskRecords,
    unclassifiedComparisonGroupRecords,
    insufficientHistoryRecords,
    riskGroupContradictions,
    staleRecords,
    duplicateFundIds: detectDuplicateFundIds(scoped),
    missingOfficialIdentifiers: scoped.filter((record) => !record.fundId).length,
    missingFundNames: scoped.filter((record) => !record.fundName).length,
    missingManagingCompanies: scoped.filter((record) => !record.managingCompany).length,
    ...returnCounts,
    excludedProductCounts,
    productCounts: countByField(records, 'productType'),
    riskCounts,
    comparisonGroupCounts: groupCounts,
    quality: deriveQualityLevel({
      eligibleRecords: eligibleRecords.length,
      rankedRecords: 0,
      staleRecords,
      totalRecords: scoped.length,
    }),
  };
}

module.exports = {
  STALE_SYNC_DAYS,
  normalizeGemelNetRow,
  normalizePensiaNetRow,
  isEligibleForRanking,
  hasValidReturn,
  buildMarketDataQuality,
  isStaleRecord,
};
