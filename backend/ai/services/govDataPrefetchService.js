'use strict';

/**
 * Warm pension + insurance gov caches and verify gemel/bituah DB snapshots.
 */
const { loadGovTracks } = require('../../services/pensionGovDataService');
const { loadServiceIndex } = require('../../services/insuranceGovDataService');
const { getGovMarketStatus } = require('../../jobs/govMarketMonthlySync');

/**
 * @param {object} [options]
 * @param {boolean} [options.forceRefresh]
 */
async function prefetchGovMarketData({ forceRefresh = false } = {}) {
  const [pensionResult, insuranceResult, marketStatus] = await Promise.allSettled([
    loadGovTracks({ forceRefresh }),
    loadServiceIndex({ forceRefresh }),
    getGovMarketStatus(),
  ]);

  const pension = pensionResult.status === 'fulfilled'
    ? {
      source: pensionResult.value.source,
      trackCount: pensionResult.value.tracks?.length ?? 0,
      cached: pensionResult.value.cached ?? false,
      warning: pensionResult.value.warning ?? null,
    }
    : { error: pensionResult.reason?.message || 'pension fetch failed' };

  const insurance = insuranceResult.status === 'fulfilled'
    ? {
      source: insuranceResult.value.source,
      providerCount: insuranceResult.value.rows?.length ?? 0,
      cached: insuranceResult.value.cached ?? false,
      warning: insuranceResult.value.warning ?? null,
    }
    : { error: insuranceResult.reason?.message || 'insurance fetch failed' };

  const nets = marketStatus.status === 'fulfilled'
    ? marketStatus.value.nets
    : { error: marketStatus.reason?.message || 'gov market status failed' };

  const gemelReady = nets.gemel?.fundCount > 0;
  const bituahReady = nets.bituah?.fundCount > 0;
  const pensiaReady = nets.pensia?.fundCount > 0;

  return {
    prefetchedAt: new Date().toISOString(),
    pension,
    insurance,
    nets,
    ready: !pension.error && !insurance.error && gemelReady && bituahReady && pensiaReady,
  };
}

module.exports = { prefetchGovMarketData };
