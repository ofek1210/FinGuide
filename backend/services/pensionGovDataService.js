

const fs = require('fs');
const path = require('path');
const config = require('../config/pensionGovDataConfig');
const { TRACKS, getTracksByCohort } = require('../config/pensionBenchmarkTables');
const { normalizeFundRiskLevel } = require('../utils/pensionShared');

let cache = { tracks: null, fetchedAt: 0, source: 'static' };

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
  if (!Number.isFinite(n)) return null;
  if (n > 0 && n < 1) return n * 100;
  return n;
}

function parseFeeDecimal(val) {
  const pct = parsePercent(val);
  if (pct == null) return null;
  return pct / 100;
}

function findCol(headers, ...needles) {
  for (let i = 0; i < headers.length; i++) {
    const h = normalizeText(headers[i]);
    if (!h) continue;
    if (needles.some(n => h.includes(normalizeText(n)))) return i;
  }
  return -1;
}

function inferRiskLevel(text) {
  const t = normalizeText(text);
  if (t.includes('גבוה') || t.includes('מניות') || t.includes('high')) return 'high';
  if (t.includes('נמוך') || t.includes('סוליד') || t.includes('low')) return 'low';
  if (t.includes('בינונ') || t.includes('medium')) return 'medium';
  return 'medium';
}

function inferProductType(text) {
  const t = normalizeText(text);
  if (t.includes('השתלמות') || t.includes('study')) return 'study_fund';
  if (t.includes('גמל') || t.includes('provident')) return 'provident_fund';
  if (t.includes('כללית') || t.includes('old')) return 'pension_old';
  if (t.includes('מנהלים') || t.includes('managers')) return 'managers_insurance';
  if (t.includes('מקיפה') || t.includes('comprehensive')) return 'pension_comprehensive';
  return 'other';
}

function isDefaultSelected(text) {
  const t = normalizeText(text);
  return t.includes('נבחר') || t.includes('default') || t.includes('ברירת מחדל') || t === 'כן' || t === 'yes';
}

/**
 * Parse Pensia-Net / Gemel-Net CSV (flexible headers — 2024+ gov format).
 * @param {string} csvText
 * @returns {object[]}
 */
function parseGovCsv(csvText) {
  const lines = String(csvText || '').split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  const delimiter = lines[0].includes('\t') ? '\t' : ',';
  const headers = lines[0].split(delimiter).map(h => h.trim().replace(/^"|"$/g, ''));

  const col = {
    provider: findCol(headers, 'תאגיד', 'מנהל', 'MANAGING', 'provider'),
    fundName: findCol(headers, 'שם הקרן', 'שם קרן', 'FUND_NAME', 'name'),
    productType: findCol(headers, 'סוג קרן', 'FUND_TYPE', 'product'),
    track: findCol(headers, 'מסלול', 'track', 'התמחות'),
    return1Y: findCol(headers, '12 חודש', 'שנה', '1 year', 'return_1', 'תשואה שנתית'),
    return3Y: findCol(headers, '36 חודש', '3 year', 'return_3', '3 שנ'),
    return5Y: findCol(headers, '60 חודש', '5 year', 'return_5', '5 שנ'),
    mgmtFee: findCol(headers, 'דמי ניהול', 'MANAGEMENT_FEE', 'AVG_ANNUAL_MANAGEMENT'),
    mgmtDepositFee: findCol(headers, 'מהפקדה', 'deposit fee'),
    defaultFlag: findCol(headers, 'נבחר', 'default', 'ברירת מחדל'),
  };

  const tracks = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(delimiter).map(c => c.trim().replace(/^"|"$/g, ''));
    if (cells.every(c => !c)) continue;

    const get = idx => (idx >= 0 ? cells[idx] : '') || '';
    const provider = get(col.provider).trim();
    const fundName = get(col.fundName).trim();
    const productRaw = get(col.productType);
    const trackRaw = get(col.track);

    if (!provider && !fundName) continue;

    const context = `${productRaw} ${trackRaw} ${fundName}`;
    const riskLevel = inferRiskLevel(context);
    const productType = inferProductType(context);

    let return1Y = col.return1Y >= 0 ? parsePercent(get(col.return1Y)) : null;
    let return3Y = col.return3Y >= 0 ? parsePercent(get(col.return3Y)) : null;
    const return5Y = col.return5Y >= 0 ? parsePercent(get(col.return5Y)) : null;

    if (return1Y == null && return5Y != null) return1Y = return5Y * 0.85;
    if (return3Y == null && return1Y != null && return5Y != null) {
      return3Y = (return1Y + return5Y) / 2;
    }

    const mgmtFeeAccumulation = col.mgmtFee >= 0 ? parseFeeDecimal(get(col.mgmtFee)) : null;
    const mgmtFeeDeposit = col.mgmtDepositFee >= 0 ? parseFeeDecimal(get(col.mgmtDepositFee)) : null;
    const defaultSelected = col.defaultFlag >= 0
      ? isDefaultSelected(get(col.defaultFlag))
      : isDefaultSelected(context);

    tracks.push({
      id: `gov_${normalizeText(`${provider}_${fundName}`).replace(/\s+/g, '_').slice(0, 80)}`,
      provider,
      name: fundName || provider,
      productType,
      riskLevel,
      mgmtFeeAccumulation,
      mgmtFeeDeposit,
      return1Y,
      return3Y,
      return5Y,
      isDefaultSelected: defaultSelected,
      source: 'data.gov.il',
    });
  }

  return tracks;
}

function staticTracksFromConfig() {
  return TRACKS.map(t => ({
    id: t.id,
    provider: t.provider,
    name: t.name,
    productType: t.productType,
    riskLevel: t.riskLevel,
    mgmtFeeAccumulation: t.mgmtFeeAccumulation,
    mgmtFeeDeposit: t.mgmtFeeDeposit,
    return1Y: t.return1Y,
    return3Y: t.return3Y ?? (t.return1Y != null && t.return5Y != null ? (t.return1Y + t.return5Y) / 2 : null),
    return5Y: t.return5Y,
    isDefaultSelected: Boolean(t.isDefaultSelected),
    rank: t.rank,
    source: 'static_benchmark',
  }));
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.fetchTimeoutMs);
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'User-Agent': config.userAgent,
        Accept: 'application/json, text/csv, */*',
        ...(options.headers || {}),
      },
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

async function resolveCsvUrl() {
  if (config.csvUrlOverride) return config.csvUrlOverride;

  const searchUrl = `${config.ckanBaseUrl}/package_search?q=${encodeURIComponent(config.packageSearchQuery)}&rows=1`;
  const searchRes = await fetchWithTimeout(searchUrl);
  if (!searchRes.ok) throw new Error(`CKAN search failed: ${searchRes.status}`);

  const searchJson = await searchRes.json();
  const pkgId = searchJson?.result?.results?.[0]?.id;
  if (!pkgId) throw new Error('Pensia-Net package not found on data.gov.il');

  const showUrl = `${config.ckanBaseUrl}/package_show?id=${encodeURIComponent(pkgId)}`;
  const showRes = await fetchWithTimeout(showUrl);
  if (!showRes.ok) throw new Error(`CKAN package_show failed: ${showRes.status}`);

  const showJson = await showRes.json();
  const resources = showJson?.result?.resources || [];
  const csvResource = resources.find(r =>
    /\.csv$/i.test(r.url || r.name || '')
    && (String(r.name || '').includes('2024') || String(r.description || '').includes('2024')),
  ) || resources.find(r => /\.csv$/i.test(r.url || r.name || ''));

  if (!csvResource?.url) throw new Error('No CSV resource in Pensia-Net package');
  return csvResource.url.startsWith('http')
    ? csvResource.url
    : `https://data.gov.il${csvResource.url.startsWith('/') ? '' : '/'}${csvResource.url}`;
}

async function loadGovTracks({ forceRefresh = false } = {}) {
  const now = Date.now();
  if (!forceRefresh && cache.tracks && now - cache.fetchedAt < config.cacheTtlMs) {
    return { tracks: cache.tracks, source: cache.source, cached: true };
  }

  if (!config.enabled) {
    const tracks = staticTracksFromConfig();
    cache = { tracks, fetchedAt: now, source: 'static_disabled' };
    return { tracks, source: 'static_disabled', cached: false };
  }

  const fixturePath = path.join(__dirname, '../tests/fixtures/pension-gov-sample.csv');
  const trySources = [];

  try {
    const csvUrl = await resolveCsvUrl();
    trySources.push({ type: 'remote', url: csvUrl });
    const csvRes = await fetchWithTimeout(csvUrl);
    if (!csvRes.ok) throw new Error(`CSV download failed: ${csvRes.status}`);
    const csvText = await csvRes.text();
    const parsed = parseGovCsv(csvText);
    if (parsed.length > 0) {
      cache = { tracks: parsed, fetchedAt: now, source: 'data.gov.il' };
      return { tracks: parsed, source: 'data.gov.il', cached: false };
    }
  } catch (err) {
    console.warn('[pensionGovData] remote fetch failed:', err.message);
  }

  if (fs.existsSync(fixturePath)) {
    trySources.push({ type: 'fixture', url: fixturePath });
    const parsed = parseGovCsv(fs.readFileSync(fixturePath, 'utf8'));
    if (parsed.length > 0) {
      cache = { tracks: parsed, fetchedAt: now, source: 'fixture' };
      return { tracks: parsed, source: 'fixture', cached: false };
    }
  }

  const tracks = staticTracksFromConfig();
  cache = { tracks, fetchedAt: now, source: 'static_fallback' };
  return { tracks, source: 'static_fallback', cached: false, warning: 'live gov data unavailable' };
}

function getCohortTracks(tracks, productType, riskLevel) {
  const cohort = tracks.filter(t =>
    t.productType === productType && t.riskLevel === riskLevel,
  );
  if (cohort.length >= 3) return cohort;
  return tracks.filter(t => t.riskLevel === riskLevel);
}

function matchUserFundToGovTrack(fund, tracks) {
  const fundText = normalizeText(`${fund.provider || ''} ${fund.fundName || ''} ${fund.investmentTrack || ''}`);
  let best = null;
  let bestScore = 0;

  for (const track of tracks) {
    const trackText = normalizeText(`${track.provider} ${track.name}`);
    const ta = new Set(fundText.split(' ').filter(Boolean));
    const tb = new Set(trackText.split(' ').filter(Boolean));
    let overlap = 0;
    for (const t of ta) if (tb.has(t)) overlap += 1;
    let score = ta.size && tb.size ? overlap / Math.max(ta.size, tb.size) : 0;
    if (fund.provider && normalizeText(track.provider).includes(normalizeText(fund.provider))) score += 0.35;
    if (score > bestScore) {
      bestScore = score;
      best = track;
    }
  }

  if (!best || bestScore < 0.2) {
    const risk = normalizeFundRiskLevel(fund.riskLevel || 'medium');
    const cohort = getCohortTracks(tracks, fund.fundType || 'other', risk);
    best = cohort[0] || null;
  }

  return { track: best, confidence: Math.round(bestScore * 100) };
}

function clearGovCache() {
  cache = { tracks: null, fetchedAt: 0, source: 'static' };
}

module.exports = {
  parseGovCsv,
  loadGovTracks,
  staticTracksFromConfig,
  getCohortTracks,
  matchUserFundToGovTrack,
  clearGovCache,
};
