'use strict';

require('dotenv').config();
const mongoose = require('mongoose');
const { getPensionMarketComparison, getGemelMarketComparison } = require('../services/marketComparison/marketComparisonService');

async function summarize(product, risk = 'high', period = 'combined', limit = 5) {
  const loader = product === 'pension'
    ? () => getPensionMarketComparison({ risk, period, limit })
    : () => getGemelMarketComparison({ product, risk, period, limit });

  const result = await loader();
  const totalRankedFunds = result.groups.reduce((sum, group) => sum + group.funds.length, 0);
  const groupsWithFunds = result.groups.filter((group) => group.funds.length > 0);

  return {
    product: result.product,
    risk: result.risk,
    period: result.period,
    groupCount: result.groups.length,
    groupsWithRankedFunds: groupsWithFunds.length,
    totalReturnedFunds: totalRankedFunds,
    sampleGroup: groupsWithFunds[0] || null,
    methodology: result.methodology,
    dataQuality: result.dataQuality,
  };
}

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('=== Revised Step 3 Market Comparison Report ===\n');

  for (const product of ['pension', 'gemel', 'hishtalmut', 'investment_gemel']) {
    const summary = await summarize(product, 'high', 'combined', 5);
    console.log(`--- ${product} ---`);
    console.log(JSON.stringify(summary, null, 2));
    console.log('');
  }

  await mongoose.disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
