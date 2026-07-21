'use strict';

const { loadGemelNetComparisonRecords } = require('./gemelNetBaseAdapter');

async function loadGemelComparisonRecords() {
  return loadGemelNetComparisonRecords('gemel');
}

module.exports = {
  loadGemelComparisonRecords,
};
