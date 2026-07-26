'use strict';

const { loadGemelNetComparisonRecords } = require('./gemelNetBaseAdapter');

async function loadHishtalmutComparisonRecords() {
  return loadGemelNetComparisonRecords('hishtalmut');
}

module.exports = {
  loadHishtalmutComparisonRecords,
};
