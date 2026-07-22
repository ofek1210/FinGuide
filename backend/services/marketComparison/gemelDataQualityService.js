'use strict';

const GemelNetFund = require('../../models/GemelNetFund');
const { GEMEL_PRODUCT_TYPES } = require('./comparisonContract');
const {
  classifyGemelNetProduct,
  EMPTY_SUG_REASON,
  OTHER_PURPOSE_REASON,
  UNRECOGNIZED_SUG_REASON,
} = require('./productClassificationService');

function emptyProductCounts() {
  return Object.fromEntries(GEMEL_PRODUCT_TYPES.map((type) => [type, 0]));
}

function countReturnCoverage(records) {
  const coverage = {
    return12Months: 0,
    return36MonthsAnnualized: 0,
    return5YearsAnnualized: 0,
  };

  for (const row of records) {
    if (row.TSUA_12_HODASHIM != null && !Number.isNaN(row.TSUA_12_HODASHIM)) {
      coverage.return12Months += 1;
    }
    if (row.TSUA_36_HODASHIM != null && !Number.isNaN(row.TSUA_36_HODASHIM)) {
      coverage.return36MonthsAnnualized += 1;
    }
    if (row.TSUA_SHNATIT_MEMUZAAT_5_SHANIM != null && !Number.isNaN(row.TSUA_SHNATIT_MEMUZAAT_5_SHANIM)) {
      coverage.return5YearsAnnualized += 1;
    }
  }

  return coverage;
}

/**
 * Build product and return-field quality metadata from GemelNet fund rows.
 *
 * @param {Array<{ ID?: string, SUG_KRN?: string, TSUA_12_HODASHIM?: number | null, TSUA_36_HODASHIM?: number | null, TSUA_SHNATIT_MEMUZAAT_5_SHANIM?: number | null }>} records
 */
function buildGemelDataQualityReport(records) {
  const productCounts = emptyProductCounts();
  const excludedFromPublicTable = {
    child_savings: 0,
    central_severance: 0,
    unknownEmptyClassification: 0,
    unknownOtherPurpose: 0,
    unknownUnrecognized: 0,
  };

  const unknownProductRecords = [];

  for (const row of records) {
    const classification = classifyGemelNetProduct(row);
    productCounts[classification.productType] += 1;

    if (classification.productType === 'child_savings') {
      excludedFromPublicTable.child_savings += 1;
    } else if (classification.productType === 'central_severance') {
      excludedFromPublicTable.central_severance += 1;
    } else if (classification.productType === 'unknown') {
      if (classification.classificationReason === EMPTY_SUG_REASON) {
        excludedFromPublicTable.unknownEmptyClassification += 1;
      } else if (classification.classificationReason === OTHER_PURPOSE_REASON) {
        excludedFromPublicTable.unknownOtherPurpose += 1;
      } else if (classification.classificationReason === UNRECOGNIZED_SUG_REASON) {
        excludedFromPublicTable.unknownUnrecognized += 1;
      }

      unknownProductRecords.push({
        id: row.ID ?? null,
        sugKrn: classification.rawSugKrn,
        reason: classification.classificationReason,
      });
    }
  }

  const publicProductCounts = {
    gemel: productCounts.gemel,
    hishtalmut: productCounts.hishtalmut,
    investment_gemel: productCounts.investment_gemel,
  };

  const returnFieldCoverage = countReturnCoverage(records);
  const publicRecords = records.filter(
    (row) => classifyGemelNetProduct(row).isPublicLeaderboard,
  );

  return {
    totalFunds: records.length,
    productCounts,
    publicProductCounts,
    publicLeaderboardTotal: publicRecords.length,
    excludedFromPublicTable,
    unknownProductRecords,
    returnFieldCoverage: {
      allFunds: returnFieldCoverage,
      publicLeaderboard: countReturnCoverage(publicRecords),
    },
  };
}

async function getGemelDataQualityFromDb() {
  const records = await GemelNetFund.find({})
    .select(
      'ID SUG_KRN TSUA_12_HODASHIM TSUA_36_HODASHIM TSUA_SHNATIT_MEMUZAAT_5_SHANIM syncedAt TKUFAT_DUACH',
    )
    .lean();

  const report = buildGemelDataQualityReport(records);
  const latest = records.reduce(
    (acc, row) => {
      if (row.syncedAt && (!acc.syncedAt || row.syncedAt > acc.syncedAt)) {
        acc.syncedAt = row.syncedAt;
      }
      if (row.TKUFAT_DUACH != null && row.TKUFAT_DUACH > (acc.latestReportPeriod ?? 0)) {
        acc.latestReportPeriod = row.TKUFAT_DUACH;
      }
      return acc;
    },
    { syncedAt: null, latestReportPeriod: null },
  );

  return {
    ...report,
    syncedAt: latest.syncedAt,
    latestReportPeriod: latest.latestReportPeriod,
  };
}

module.exports = {
  buildGemelDataQualityReport,
  getGemelDataQualityFromDb,
};
