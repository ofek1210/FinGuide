'use strict';

const govConfig = require('../config/govDataConfig');

const PACKAGE_IDS = {
  pensia: process.env.PENSIANET_PACKAGE_ID || '3a1ca8fa-738b-4890-b52f-e8f7ce1e6145',
  gemel: process.env.GEMELNET_PACKAGE_ID || '5265b154-c2e2-4f3d-a22e-fba593240d9a',
  bituah: process.env.BITUAHNET_PACKAGE_ID || '',
};

async function fetchWithTimeout(url, timeoutMs = govConfig.fetchTimeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': govConfig.userAgent,
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

function scoreCsvResource(resource) {
  if (!resource || String(resource.format || '').toUpperCase() !== 'CSV') return -1;
  const name = String(resource.name || '');
  let score = 0;
  if (/היום|today/i.test(name)) score += 100;
  if (/2024|2025|2026/.test(name)) score += 20;
  if (resource.last_modified) {
    score += new Date(resource.last_modified).getTime() / 1e12;
  }
  return score;
}

/**
 * Pick the newest CSV resource from a data.gov.il package.
 * @param {string} packageId
 * @returns {Promise<{ resourceId: string, name: string, downloadUrl: string, lastModified: string|null }|null>}
 */
async function discoverLatestCsvResource(packageId) {
  if (!packageId) return null;

  const url = `${govConfig.ckanBaseUrl}/package_show?id=${encodeURIComponent(packageId)}`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) {
    throw new Error(`package_show failed (${res.status}) for ${packageId}`);
  }

  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error?.message || 'package_show success=false');
  }

  const resources = json.result?.resources || [];
  const best = resources
    .map(r => ({ r, score: scoreCsvResource(r) }))
    .filter(x => x.score >= 0)
    .sort((a, b) => b.score - a.score)[0];

  if (!best) return null;

  const resourceId = best.r.id;
  const downloadUrl = best.r.url?.includes('/download/')
    ? best.r.url
    : `https://e.data.gov.il/dataset/${packageId}/resource/${resourceId}/download/file.csv`;

  return {
    resourceId,
    name: best.r.name,
    downloadUrl,
    lastModified: best.r.last_modified || null,
  };
}

/**
 * Resolve resource ID — env override or auto-discovery.
 * @param {'pensia'|'gemel'|'bituah'} net
 * @param {string} [configuredId]
 */
async function resolveLatestResourceId(net, configuredId) {
  if (configuredId) {
    return {
      resourceId: configuredId,
      source: 'env',
      discovered: null,
    };
  }

  if (!govConfig.autoDiscoverResources) {
    return { resourceId: null, source: 'none', discovered: null };
  }

  const packageId = PACKAGE_IDS[net];
  if (!packageId) {
    return { resourceId: null, source: 'none', discovered: null };
  }

  const discovered = await discoverLatestCsvResource(packageId);
  return {
    resourceId: discovered?.resourceId || null,
    source: discovered ? 'discovered' : 'none',
    discovered,
  };
}

module.exports = {
  PACKAGE_IDS,
  discoverLatestCsvResource,
  resolveLatestResourceId,
  scoreCsvResource,
};
