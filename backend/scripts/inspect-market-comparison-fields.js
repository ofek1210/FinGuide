'use strict';

require('dotenv').config();
const mongoose = require('mongoose');
const GemelNetFund = require('../models/GemelNetFund');
const PensiaNetFund = require('../models/PensiaNetFund');
const { classifyGemelNetProduct } = require('../services/marketComparison/productClassificationService');

function countBy(rows, getter) {
  const map = {};
  for (const row of rows) {
    const key = getter(row) || '(empty)';
    map[key] = (map[key] || 0) + 1;
  }
  return Object.entries(map).sort((a, b) => b[1] - a[1]);
}

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const gemel = await GemelNetFund.find({})
    .select('SUG_KRN SPECIALIZATION SUB_SPECIALIZATION SHM_KRN CHSHIF_MNUIOT')
    .lean();
  const pub = gemel.filter((r) => classifyGemelNetProduct(r).isPublicLeaderboard);

  console.log('=== Gemel public SPECIALIZATION ===');
  console.log(JSON.stringify(countBy(pub, (r) => r.SPECIALIZATION), null, 2));
  console.log('=== Gemel public SUB_SPECIALIZATION ===');
  console.log(JSON.stringify(countBy(pub, (r) => r.SUB_SPECIALIZATION), null, 2));

  const pensia = await PensiaNetFund.find({}).select('SHM_KRN SUG_KRN CHSHIF_MNUIOT').lean();
  console.log('=== Pension SUG_KRN ===');
  console.log(JSON.stringify(countBy(pensia, (r) => r.SUG_KRN), null, 2));
  console.log('=== Pension SHM_KRN samples (first 40 unique) ===');
  const names = [...new Set(pensia.map((r) => r.SHM_KRN))].slice(0, 40);
  console.log(JSON.stringify(names, null, 2));

  await mongoose.disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
