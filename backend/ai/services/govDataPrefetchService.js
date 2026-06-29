'use strict';

/**
 * Prefetch government market data (data.gov.il) into in-memory cache before agents run.
 */
const { loadGovTracks } = require('../../services/pensionGovDataService');
const { loadServiceIndex } = require('../../services/insuranceGovDataService');

/**
 * Warm pension + insurance gov caches.
 * @param {object} [options]
 * @param {boolean} [options.forceRefresh]
 */
async function prefetchGovMarketData({ forceRefresh = false } = {}) {
  const [pensionResult, insuranceResult] = await Promise.allSettled([
    loadGovTracks({ forceRefresh }),
    loadServiceIndex({ forceRefresh }),
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

  return {
    prefetchedAt: new Date().toISOString(),
    pension,
    insurance,
    ready: !pension.error && !insurance.error,
  };
}

module.exports = { prefetchGovMarketData };
