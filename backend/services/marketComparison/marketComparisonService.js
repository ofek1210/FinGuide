'use strict';

const { ValidationError } = require('../../utils/appErrors');
const {
  PUBLIC_COMPARISON_PRODUCTS,
  RISK_LEVELS,
  COMPARISON_PERIODS,
  COMBINED_PERIOD_WEIGHTS,
  MINIMUM_PERIODS_FOR_COMBINED,
  RANKING_METHOD,
  RANKING_STATUS,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  FUTURE_SCORE_FIELDS,
} = require('./comparisonContract');
const { loadPensionComparisonRecords } = require('./adapters/pensionComparisonAdapter');
const { loadGemelComparisonRecords } = require('./adapters/gemelComparisonAdapter');
const { loadHishtalmutComparisonRecords } = require('./adapters/hishtalmutComparisonAdapter');
const { loadInvestmentGemelComparisonRecords } = require('./adapters/investmentGemelComparisonAdapter');
const { loadGemelNetRecords, normalizeGemelRecords } = require('./adapters/gemelNetBaseAdapter');
const { rankFundsByComparisonGroups } = require('./rankingService');
const {
  isEligibleForRanking,
  buildMarketDataQuality,
} = require('./marketDataQualityService');
const { findRiskGroupContradictions } = require('./riskGroupCompatibilityService');

const PRODUCT_LOADERS = {
  pension: loadPensionComparisonRecords,
  gemel: loadGemelComparisonRecords,
  hishtalmut: loadHishtalmutComparisonRecords,
  investment_gemel: loadInvestmentGemelComparisonRecords,
};

function normalizeRisk(value) {
  const risk = String(value || '').trim().toLowerCase();
  if (!RISK_LEVELS.includes(risk) || risk === 'unclassified') {
    throw new ValidationError('פרמטר risk לא תקין', [
      `risk חייב להיות אחד מ: ${RISK_LEVELS.filter((level) => level !== 'unclassified').join(', ')}`,
    ]);
  }
  return risk;
}

function normalizePeriod(value) {
  const period = String(value || 'combined').trim();
  if (!COMPARISON_PERIODS.includes(period)) {
    throw new ValidationError('פרמטר period לא תקין', [
      `period חייב להיות אחד מ: ${COMPARISON_PERIODS.join(', ')}`,
    ]);
  }
  return period;
}

function normalizeProduct(value, { required = false } = {}) {
  if (!value) {
    if (required) {
      throw new ValidationError('פרמטר product נדרש', [
        'product חייב להיות gemel, hishtalmut או investment_gemel',
      ]);
    }
    return null;
  }

  const product = String(value).trim().toLowerCase();
  if (!['gemel', 'hishtalmut', 'investment_gemel'].includes(product)) {
    throw new ValidationError('פרמטר product לא תקין', [
      'product חייב להיות gemel, hishtalmut או investment_gemel',
    ]);
  }
  return product;
}

function normalizeLimit(value) {
  const parsed = Number(value ?? DEFAULT_LIMIT);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > MAX_LIMIT) {
    throw new ValidationError('פרמטר limit לא תקין', [
      `limit חייב להיות מספר בין 1 ל-${MAX_LIMIT}`,
    ]);
  }
  return Math.floor(parsed);
}

function toPublicFund(record) {
  return {
    rank: record.rank ?? null,
    rankingScore: record.rankingScore ?? null,
    rankingStatus: record.rankingStatus ?? RANKING_STATUS.EXCLUDED,
    rankingMethod: record.rankingMethod ?? RANKING_METHOD,
    effectiveWeights: record.effectiveWeights ?? {},
    productType: record.productType,
    riskLevel: record.riskLevel,
    comparisonGroup: record.comparisonGroup,
    fundId: record.fundId,
    fundName: record.fundName,
    managingCompany: record.managingCompany,
    specialization: record.specialization,
    subSpecialization: record.subSpecialization,
    return12Months: record.return12Months ?? null,
    return36MonthsAnnualized: record.return36MonthsAnnualized ?? null,
    return5YearsAnnualized: record.return5YearsAnnualized ?? null,
    assetsUnderManagement: record.assetsUnderManagement ?? null,
    managementFeeBalance: record.managementFeeBalance ?? null,
    managementFeeDeposit: record.managementFeeDeposit ?? null,
    reportPeriod: record.reportPeriod ?? null,
    lastSyncedAt: record.lastSyncedAt ?? null,
    source: record.source,
    performanceScore: null,
    feeScore: null,
    riskAdjustedScore: null,
    marketScore: null,
  };
}

function buildMethodology(period) {
  return {
    source: null,
    rankingMethod: RANKING_METHOD,
    rankScope: 'within_comparison_group_only',
    limitAppliesPerGroup: true,
    periodWeights: { ...COMBINED_PERIOD_WEIGHTS },
    minimumPeriodsForCombined: MINIMUM_PERIODS_FOR_COMBINED,
    missingPeriodPolicy: 'redistribute_available_weights',
    returnsAreHistorical: true,
    activePeriod: period,
    futureScoreFields: [...FUTURE_SCORE_FIELDS],
  };
}

async function getMarketComparison({
  product,
  risk,
  period = 'combined',
  limit = DEFAULT_LIMIT,
  comparisonGroup = null,
}) {
  const normalizedRisk = normalizeRisk(risk);
  const normalizedPeriod = normalizePeriod(period);
  const normalizedLimit = normalizeLimit(limit);
  const normalizedProduct = product === 'pension' ? 'pension' : normalizeProduct(product, { required: true });

  const loader = PRODUCT_LOADERS[normalizedProduct];
  const { records, meta, source } = await loader();

  const eligiblePool = records.filter((record) =>
    isEligibleForRanking(record, {
      period: normalizedPeriod,
      risk: normalizedRisk,
      comparisonGroup,
    }),
  );

  const rankingResult = rankFundsByComparisonGroups(eligiblePool, {
    period: normalizedPeriod,
    comparisonGroup,
    limit: normalizedLimit,
  });

  const groups = rankingResult.groups.map((group) => ({
    comparisonGroup: group.comparisonGroup,
    eligibleRecords: group.eligibleRecords,
    rankedRecords: group.rankedRecords,
    insufficientHistoryRecords: group.insufficientHistoryRecords,
    funds: group.funds.map(toPublicFund),
  }));

  let allRecordsForQuality = records;
  if (normalizedProduct !== 'pension') {
    const allGemelRows = await loadGemelNetRecords();
    allRecordsForQuality = normalizeGemelRecords(allGemelRows);
  }

  const contradictions = findRiskGroupContradictions(allRecordsForQuality.filter(
    (record) => !normalizedProduct || record.productType === normalizedProduct,
  ));

  const dataQuality = buildMarketDataQuality(allRecordsForQuality, {
    product: normalizedProduct,
    source,
    latestReportPeriod: meta.latestReportPeriod,
    lastUpdated: meta.lastUpdated,
    riskGroupContradictions: contradictions.length,
  });
  dataQuality.rankedRecords = rankingResult.totalRanked;
  dataQuality.insufficientHistoryRecords = rankingResult.totalInsufficient;
  dataQuality.quality = dataQuality.rankedRecords > 0 ? dataQuality.quality : 'medium';

  const methodology = buildMethodology(normalizedPeriod);
  methodology.source = source;

  return {
    product: normalizedProduct,
    risk: normalizedRisk,
    period: normalizedPeriod,
    comparisonGroup: comparisonGroup || null,
    groups,
    methodology,
    dataQuality,
  };
}

async function getPensionMarketComparison(params) {
  return getMarketComparison({ ...params, product: 'pension' });
}

async function getGemelMarketComparison(params) {
  return getMarketComparison(params);
}

function validatePublicProduct(product) {
  if (!PUBLIC_COMPARISON_PRODUCTS.includes(product)) {
    throw new ValidationError('מוצר לא נתמך', [`product חייב להיות אחד מ: ${PUBLIC_COMPARISON_PRODUCTS.join(', ')}`]);
  }
}

module.exports = {
  normalizeRisk,
  normalizePeriod,
  normalizeProduct,
  normalizeLimit,
  getMarketComparison,
  getPensionMarketComparison,
  getGemelMarketComparison,
  validatePublicProduct,
  toPublicFund,
};
