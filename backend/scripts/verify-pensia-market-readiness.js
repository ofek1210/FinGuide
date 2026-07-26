'use strict';

require('dotenv').config();
const mongoose = require('mongoose');
const { syncPensiaNetDataset } = require('../services/pensiaNetIngestionService');
const PensiaNetFund = require('../models/PensiaNetFund');
const { normalizePensiaNetRow } = require('../services/marketComparison/marketDataQualityService');
const { findRiskGroupContradictions } = require('../services/marketComparison/riskGroupCompatibilityService');
const { classifyComparisonGroup } = require('../services/marketComparison/comparisonGroupService');
const { classifyRisk } = require('../services/marketComparison/riskClassificationService');
const { normalizeExposurePercent } = require('../utils/normalizePercentage');
const { rankFundsByComparisonGroups } = require('../services/marketComparison/rankingService');
const { isEligibleForRanking } = require('../services/marketComparison/marketDataQualityService');

function normalizePensiaBeforeCompatibility(row) {
  const stockExposure = normalizeExposurePercent(row.CHSHIF_MNUIOT, row.YITRAT_NECHASIM);
  const enriched = { ...row, stockExposurePct: stockExposure.value };
  const group = classifyComparisonGroup(enriched, { productType: 'pension', domain: 'pension' });
  const risk = classifyRisk(enriched, { domain: 'pension', comparisonGroup: group.comparisonGroup });
  return {
    fundId: row.ID ? String(row.ID) : null,
    fundName: row.SHM_KRN || null,
    productType: 'pension',
    riskLevel: risk.riskLevel,
    comparisonGroup: group.comparisonGroup,
    stockExposurePct: stockExposure.value,
    return12Months: row.TSUA_12_HODASHIM ?? null,
    return36MonthsAnnualized: row.TSUA_36_HODASHIM ?? null,
    return5YearsAnnualized: row.TSUA_SHNATIT_MEMUZAAT_5_SHANIM ?? null,
  };
}

function countReturns(records) {
  return {
    return12Months: records.filter((r) => r.return12Months != null).length,
    return36MonthsAnnualized: records.filter((r) => r.return36MonthsAnnualized != null).length,
    return5YearsAnnualized: records.filter((r) => r.return5YearsAnnualized != null).length,
  };
}

(async () => {
  const shouldSync = process.argv.includes('--sync');
  await mongoose.connect(process.env.MONGODB_URI);

  if (shouldSync) {
    console.log('Syncing PensiaNet…');
    const syncResult = await syncPensiaNetDataset({ updateMonthly: false });
    console.log(JSON.stringify(syncResult, null, 2));
  }

  const rows = await PensiaNetFund.find({}).lean();
  const before = rows.map(normalizePensiaBeforeCompatibility);
  const after = rows.map(normalizePensiaNetRow);

  const contradictionsBefore = findRiskGroupContradictions(before);
  const contradictionsAfter = findRiskGroupContradictions(after);

  const eligibleHigh = after.filter((record) =>
    isEligibleForRanking(record, { period: 'combined', risk: 'high' }),
  );
  const ranking = rankFundsByComparisonGroups(eligibleHigh, { period: 'combined', limit: 5 });

  console.log('\n=== PensiaNet readiness ===');
  console.log('totalFunds:', rows.length);
  console.log('SUG_KRN:', JSON.stringify(
    after.reduce((acc, row) => {
      const key = rows.find((r) => String(r.ID) === row.fundId)?.SUG_KRN || '(empty)';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {}),
    null,
    2,
  ));
  console.log('returnCoverage:', countReturns(after), '/', rows.length);
  console.log('riskCounts:', JSON.stringify(
    after.reduce((acc, row) => {
      acc[row.riskLevel] = (acc[row.riskLevel] || 0) + 1;
      return acc;
    }, {}),
    null,
    2,
  ));
  console.log('comparisonGroupCounts:', JSON.stringify(
    after.reduce((acc, row) => {
      acc[row.comparisonGroup] = (acc[row.comparisonGroup] || 0) + 1;
      return acc;
    }, {}),
    null,
    2,
  ));
  console.log('risk/group contradictions before:', contradictionsBefore.length);
  console.log('risk/group contradictions after:', contradictionsAfter.length);
  console.log('eligible high (combined):', eligibleHigh.length);
  console.log('ranked groups (high):', ranking.groups.filter((g) => g.rankedRecords > 0).length);
  console.log('insufficient history total:', ranking.totalInsufficient);

  await mongoose.disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
