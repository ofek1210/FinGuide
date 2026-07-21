'use strict';

require('dotenv').config();
const mongoose = require('mongoose');
const GemelNetFund = require('../models/GemelNetFund');
const { normalizeGemelNetRow } = require('../services/marketComparison/marketDataQualityService');
const { classifyComparisonGroup } = require('../services/marketComparison/comparisonGroupService');
const { classifyRisk } = require('../services/marketComparison/riskClassificationService');
const { classifyGemelNetProduct } = require('../services/marketComparison/productClassificationService');
const { findRiskGroupContradictions, validateRiskGroupCompatibility } = require('../services/marketComparison/riskGroupCompatibilityService');
const { normalizeExposurePercent } = require('../utils/normalizePercentage');

function normalizeBeforeCompatibility(row) {
  const productClassification = classifyGemelNetProduct(row);
  const stockExposure = normalizeExposurePercent(row.CHSHIF_MNUIOT, row.YITRAT_NECHASIM);
  const enriched = { ...row, stockExposurePct: stockExposure.value };
  const group = classifyComparisonGroup(enriched, {
    productType: productClassification.productType,
    domain: 'gemel',
  });
  const risk = classifyRisk(enriched, { domain: 'gemel', comparisonGroup: group.comparisonGroup });
  return {
    fundId: row.ID,
    fundName: row.SHM_KRN,
    productType: productClassification.productType,
    riskLevel: risk.riskLevel,
    comparisonGroup: group.comparisonGroup,
    stockExposurePct: stockExposure.value,
    specialization: row.SPECIALIZATION,
    subSpecialization: row.SUB_SPECIALIZATION,
  };
}

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const rows = await GemelNetFund.find({}).lean();
  const publicRows = rows.filter((row) => classifyGemelNetProduct(row).isPublicLeaderboard);

  const before = publicRows.map(normalizeBeforeCompatibility);
  const after = publicRows.map(normalizeGemelNetRow);

  const beforeIssues = findRiskGroupContradictions(before);
  const afterIssues = findRiskGroupContradictions(after);

  const mitav = after.find((row) => row.fundId === '14264');
  if (mitav) {
    console.log('=== מיטב גמל משולב סחיר (14264) after fix ===');
    console.log(JSON.stringify({
      riskLevel: mitav.riskLevel,
      comparisonGroup: mitav.comparisonGroup,
      stockExposurePct: mitav.stockExposurePct,
      riskGroupAction: mitav.riskGroupAction,
      riskGroupValidation: mitav.riskGroupValidation,
    }, null, 2));
  }

  console.log('\n=== Risk/group audit (public GemelNet funds) ===');
  console.log('before contradictions:', beforeIssues.length);
  console.log('after contradictions:', afterIssues.length);
  console.log('\nSample before issues (up to 10):');
  console.log(JSON.stringify(beforeIssues.slice(0, 10), null, 2));
  console.log('\nSample after issues (up to 10):');
  console.log(JSON.stringify(afterIssues.slice(0, 10), null, 2));

  const generalHighBefore = before.filter(
    (row) => row.comparisonGroup?.endsWith('_general') && row.riskLevel === 'high',
  );
  const generalHighAfter = after.filter(
    (row) => row.comparisonGroup?.endsWith('_general') && row.riskLevel === 'high',
  );
  console.log('\ngeneral+high before:', generalHighBefore.length);
  console.log('general+high after:', generalHighAfter.length);

  await mongoose.disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
