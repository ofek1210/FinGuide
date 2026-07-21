'use strict';

const { loadGemelNetComparisonRecords } = require('./gemelNetBaseAdapter');

async function loadInvestmentGemelComparisonRecords() {
  return loadGemelNetComparisonRecords('investment_gemel');
}

module.exports = {
  loadInvestmentGemelComparisonRecords,
};
