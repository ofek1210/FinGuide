

const fs = require('fs');
const path = require('path');
const config = require('../config/insuranceGovDataConfig');
const {
  PROVIDERS,
  MARKET_DEFAULTS,
  matchProvider,
} = require('../config/insuranceServiceIndexTables');

let cache = { rows: null, fetchedAt: 0, source: 'static' };

function normalizeText(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^\u0590-\u05FFa-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parsePercent(val) {
  if (val == null || val === '') return null;
  const n = parseFloat(String(val).replace(/[%₪,\s]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function findCol(headers, ...needles) {
  for (let i = 0; i < headers.length; i++) {
    const h = normalizeText(headers[i]);
    if (!h) continue;
    if (needles.some(n => h.includes(normalizeText(n)))) return i;
  }
  return -1;
}

function parseServiceIndexCsv(csvText) {
  const lines = String(csvText || '').split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  const delimiter = lines[0].includes('\t') ? '\t' : ',';
  const headers = lines[0].split(delimiter).map(h => h.trim().replace(/^"|"$/g, ''));

  const col = {
    provider: findCol(headers, 'חברה', 'מבטח', 'provider', 'company'),
    branch: findCol(headers, 'ענף', 'branch', 'תחום'),
    claimRate: findCol(headers, 'תשלום תביעות', 'claim', 'אחוז תביעות'),
    satisfaction: findCol(headers, 'שביעות', 'satisfaction', 'רצון'),
    serviceIndex: findCol(headers, 'מדד שירות', 'service index', 'מדד'),
  };

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(delimiter).map(c => c.trim().replace(/^"|"$/g, ''));
    if (cells.every(c => !c)) continue;

    const get = idx => (idx >= 0 ? cells[idx] : '') || '';
    const provider = get(col.provider).trim();
    if (!provider) continue;

    const claimPaymentRate = col.claimRate >= 0 ? parsePercent(get(col.claimRate)) : null;
    const satisfactionScore = col.satisfaction >= 0 ? parsePercent(get(col.satisfaction)) : null;
    let serviceIndex = col.serviceIndex >= 0 ? parsePercent(get(col.serviceIndex)) : null;

    if (serviceIndex == null && claimPaymentRate != null && satisfactionScore != null) {
      serviceIndex = Math.round(claimPaymentRate * 0.6 + satisfactionScore * 0.4);
    }

    rows.push({
      provider,
      branchType: get(col.branch) || 'other',
      claimPaymentRate,
      satisfactionScore,
      serviceIndex,
      source: 'data.gov.il',
    });
  }

  return rows;
}

function staticRowsFromConfig() {
  return PROVIDERS.map(p => ({
    provider: p.names[0],
    branchType: 'all',
    claimPaymentRate: p.claimPaymentRate,
    satisfactionScore: p.satisfactionScore,
    serviceIndex: p.serviceIndex,
    source: 'static_index',
  }));
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.fetchTimeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'User-Agent': config.userAgent,
        Accept: 'application/json, text/csv, */*',
        ...(options.headers || {}),
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

async function resolveCsvUrl() {
  if (config.csvUrlOverride) return config.csvUrlOverride;

  const searchUrl = `${config.ckanBaseUrl}/package_search?q=${encodeURIComponent(config.packageSearchQuery)}&rows=3`;
  const searchRes = await fetchWithTimeout(searchUrl);
  if (!searchRes.ok) throw new Error(`CKAN search failed: ${searchRes.status}`);

  const searchJson = await searchRes.json();
  const pkg = searchJson?.result?.results?.find(r =>
    String(r.title || '').includes('מדד') || String(r.title || '').includes('שירות'),
  ) || searchJson?.result?.results?.[0];

  if (!pkg?.id) throw new Error('Insurance service index package not found');

  const showUrl = `${config.ckanBaseUrl}/package_show?id=${encodeURIComponent(pkg.id)}`;
  const showRes = await fetchWithTimeout(showUrl);
  if (!showRes.ok) throw new Error(`CKAN package_show failed: ${showRes.status}`);

  const showJson = await showRes.json();
  const resources = showJson?.result?.resources || [];
  const csvResource = resources.find(r => /\.csv$/i.test(r.url || r.name || ''));
  if (!csvResource?.url) throw new Error('No CSV in service index package');

  return csvResource.url.startsWith('http')
    ? csvResource.url
    : `https://data.gov.il${csvResource.url.startsWith('/') ? '' : '/'}${csvResource.url}`;
}

async function loadServiceIndex({ forceRefresh = false } = {}) {
  const now = Date.now();
  if (!forceRefresh && cache.rows && now - cache.fetchedAt < config.cacheTtlMs) {
    return { rows: cache.rows, source: cache.source, cached: true };
  }

  const localCsvPath = path.join(config.localDataDir, config.localServiceIndexFile);
  const fixturePath = path.join(__dirname, '../tests/fixtures/insurance-service-index-sample.csv');

  if (fs.existsSync(localCsvPath)) {
    const parsed = parseServiceIndexCsv(fs.readFileSync(localCsvPath, 'utf8'));
    if (parsed.length > 0) {
      cache = { rows: parsed, fetchedAt: now, source: 'local_csv' };
      return { rows: parsed, source: 'local_csv', cached: false };
    }
  }

  if (fs.existsSync(fixturePath)) {
    const parsed = parseServiceIndexCsv(fs.readFileSync(fixturePath, 'utf8'));
    if (parsed.length > 0) {
      cache = { rows: parsed, fetchedAt: now, source: 'fixture' };
      return { rows: parsed, source: 'fixture', cached: false };
    }
  }

  if (config.enabled && config.remoteFetchEnabled) {
    try {
      const csvUrl = await resolveCsvUrl();
      const csvRes = await fetchWithTimeout(csvUrl);
      if (!csvRes.ok) throw new Error(`CSV download failed: ${csvRes.status}`);
      const parsed = parseServiceIndexCsv(await csvRes.text());
      if (parsed.length > 0) {
        cache = { rows: parsed, fetchedAt: now, source: 'data.gov.il' };
        return { rows: parsed, source: 'data.gov.il', cached: false };
      }
    } catch (err) {
      console.warn('[insuranceGovData] remote fetch skipped/failed:', err.message);
    }
  }

  const rows = staticRowsFromConfig();
  cache = { rows, fetchedAt: now, source: 'static_fallback' };
  return { rows, source: 'static_fallback', cached: false, warning: 'using static service index — local CSV preferred' };
}

function lookupProviderScores(providerName, policyType, govRows) {
  const key = normalizeText(providerName);
  const branch = normalizeText(policyType);

  const govMatch = govRows.find(r => {
    const p = normalizeText(r.provider);
    const b = normalizeText(r.branchType);
    return key.includes(p) || p.includes(key.split(' ')[0])
      ? (b === 'all' || b === branch || branch === 'other' || !b)
      : false;
  });

  if (govMatch?.serviceIndex != null) {
    return {
      claimPaymentRate: govMatch.claimPaymentRate ?? MARKET_DEFAULTS.claimPaymentRate,
      satisfactionScore: govMatch.satisfactionScore ?? MARKET_DEFAULTS.satisfactionScore,
      serviceIndex: govMatch.serviceIndex,
      matched: true,
      source: govMatch.source || 'data.gov.il',
    };
  }

  const { getServiceScores } = require('../config/insuranceServiceIndexTables');
  const staticScores = getServiceScores(providerName, policyType);
  return { ...staticScores, source: 'static_index' };
}

function clearServiceIndexCache() {
  cache = { rows: null, fetchedAt: 0, source: 'static' };
}

module.exports = {
  parseServiceIndexCsv,
  loadServiceIndex,
  lookupProviderScores,
  staticRowsFromConfig,
  clearServiceIndexCache,
  matchProvider,
};
