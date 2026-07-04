'use strict';

const config = require('../config/pensionFinqConfig');
const PensionLeadingFundCache = require('../models/PensionLeadingFundCache');
const { AppError } = require('../utils/appErrors');

const { RISK_LEVELS, DEFAULT_RISK } = config;

/**
 * Normalize ?risk= query values to Finq risk enum.
 * @param {string|undefined} raw
 * @returns {'LOW'|'MEDIUM'|'HIGH'|'INCREASED'}
 */
function normalizeRiskLevel(raw) {
  const key = String(raw || DEFAULT_RISK)
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
  const aliases = {
    LOW: 'LOW',
    MEDIUM: 'MEDIUM',
    MED: 'MEDIUM',
    HIGH: 'HIGH',
    INCREASED: 'INCREASED',
    INCREASE: 'INCREASED',
    ELEVATED: 'INCREASED',
    מוגבר: 'INCREASED',
    גבוה: 'HIGH',
    בינוני: 'MEDIUM',
    נמוך: 'LOW',
  };
  const mapped = aliases[key] || key;
  if (!RISK_LEVELS.includes(mapped)) {
    throw new AppError(`רמת סיכון לא תקינה. ערכים מותרים: ${RISK_LEVELS.join(', ')}`, 400);
  }
  return mapped;
}

function parseNumber(val) {
  if (val == null || val === '') return null;
  const n = parseFloat(String(val).replace(/[%₪,\s]/g, ''));
  return Number.isFinite(n) ? n : null;
}

/**
 * Map Finq API payload → stable DTO for UI + cache.
 * @param {object} raw
 * @param {string} riskCategory
 */
function normalizeFinqFund(raw, riskCategory) {
  if (!raw || typeof raw !== 'object') return null;
  const id = String(
    raw.id ?? raw.fundId ?? raw.fund_id ?? raw._id ?? raw.symbol ?? '',
  ).trim();
  if (!id) return null;

  return {
    id,
    fundName:
      raw.fundName ??
      raw.fund_name ??
      raw.name ??
      raw.title ??
      '',
    managingBody:
      raw.managingBody ??
      raw.managing_body ??
      raw.manager ??
      raw.provider ??
      raw.company ??
      '',
    yield3Years: parseNumber(
      raw.yield3Years ??
        raw.yield_3_years ??
        raw.threeYearYield ??
        raw.return_3_years,
    ),
    managementFeeAccumulation: parseNumber(
      raw.managementFeeAccumulation ??
        raw.mgmt_fee_accumulation ??
        raw.accumulationFee ??
        raw.fee_from_accumulation,
    ),
    managementFeeDeposit: parseNumber(
      raw.managementFeeDeposit ??
        raw.mgmt_fee_deposit ??
        raw.depositFee ??
        raw.fee_from_deposit,
    ),
    sharpeRatio: parseNumber(raw.sharpeRatio ?? raw.sharpe_ratio ?? raw.sharpe),
    riskCategory: raw.riskLevel ?? raw.risk_level ?? raw.risk ?? riskCategory,
    raw,
  };
}

function extractFundList(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.funds)) return payload.funds;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

function buildLeadingFundsUrl(riskCategory) {
  const params = new URLSearchParams({
    category: config.DEFAULT_CATEGORY,
    sortBy: config.DEFAULT_SORT,
    risk_level: riskCategory,
  });
  return `${config.FINQ_BASE_URL}${config.FINQ_LEADING_FUNDS_PATH}?${params.toString()}`;
}

function buildFundDetailUrl(fundId) {
  const encoded = encodeURIComponent(fundId);
  return `${config.FINQ_BASE_URL}${config.FINQ_FUND_DETAIL_PATH}/${encoded}`;
}

function finqHeaders() {
  const headers = {
    Accept: 'application/json',
    'User-Agent': 'FinGuide/1.0 (+https://finguide.app)',
  };
  if (config.FINQ_AUTH_TOKEN) {
    headers.Authorization = `Bearer ${config.FINQ_AUTH_TOKEN}`;
  }
  return headers;
}

async function finqFetch(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.FINQ_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: finqHeaders(), signal: controller.signal });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new AppError(
        `Finq API error ${res.status}${body ? `: ${body.slice(0, 120)}` : ''}`,
        res.status >= 500 ? 502 : 502,
      );
    }
    return res.json();
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new AppError('Finq API timeout', 504);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function isCacheFresh(doc) {
  if (!doc?.updatedAt) return false;
  return Date.now() - new Date(doc.updatedAt).getTime() < config.FINQ_CACHE_TTL_MS;
}

async function readCache(riskCategory) {
  return PensionLeadingFundCache.findOne({ riskCategory }).lean();
}

async function writeCache(riskCategory, funds, { source = 'finq' } = {}) {
  const now = new Date();
  const sanitized = funds.map(({ raw, ...rest }) => rest);
  const doc = await PensionLeadingFundCache.findOneAndUpdate(
    { riskCategory },
    {
      riskCategory,
      funds: sanitized,
      updatedAt: now,
      finqFetchedAt: now,
      source,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();
  return doc;
}

/**
 * Fetch leading funds for a risk cohort — Finq live with per-risk Mongo cache.
 * @param {string} risk
 * @param {{ forceRefresh?: boolean }} [options]
 */
async function getLeadingFunds(risk, { forceRefresh = false } = {}) {
  const riskCategory = normalizeRiskLevel(risk);

  if (!forceRefresh) {
    const cached = await readCache(riskCategory);
    if (cached && isCacheFresh(cached) && cached.funds?.length) {
      return {
        riskCategory,
        funds: cached.funds,
        source: 'cache',
        updatedAt: cached.updatedAt,
        cached: true,
      };
    }
  }

  if (!config.FINQ_ENABLED) {
    const stale = await readCache(riskCategory);
    if (stale?.funds?.length) {
      return {
        riskCategory,
        funds: stale.funds,
        source: 'cache_fallback',
        updatedAt: stale.updatedAt,
        cached: true,
        warning: 'Finq API מושבת — מוצגים נתוני cache',
      };
    }
    throw new AppError('Finq API מושבת ואין נתוני cache זמינים', 503);
  }

  try {
    const url = buildLeadingFundsUrl(riskCategory);
    const payload = await finqFetch(url);
    const normalized = extractFundList(payload)
      .map(item => normalizeFinqFund(item, riskCategory))
      .filter(Boolean);

    if (!normalized.length) {
      const stale = await readCache(riskCategory);
      if (stale?.funds?.length) {
        return {
          riskCategory,
          funds: stale.funds,
          source: 'cache_fallback',
          updatedAt: stale.updatedAt,
          cached: true,
          warning: 'Finq החזיר רשימה ריקה — מוצג cache אחרון',
        };
      }
      return {
        riskCategory,
        funds: [],
        source: 'finq',
        updatedAt: new Date(),
        cached: false,
      };
    }

    const doc = await writeCache(riskCategory, normalized, { source: 'finq' });
    return {
      riskCategory,
      funds: doc.funds,
      source: 'finq',
      updatedAt: doc.updatedAt,
      cached: false,
    };
  } catch (err) {
    console.warn('[PensionService] Finq leading-funds failed:', err.message);
    const stale = await readCache(riskCategory);
    if (stale?.funds?.length) {
      return {
        riskCategory,
        funds: stale.funds,
        source: 'cache_fallback',
        updatedAt: stale.updatedAt,
        cached: true,
        warning: 'שגיאה ב-Finq — מוצגים נתוני cache אחרונים לרמת הסיכון הזו',
      };
    }
    throw err instanceof AppError ? err : new AppError('לא הצלחנו לטעון קרנות מובילות', 502);
  }
}

/**
 * Deep fund metrics — Finq detail endpoint with cache fallback scoped to risk.
 * @param {string} fundId
 * @param {{ risk?: string }} [options]
 */
async function getFundById(fundId, { risk } = {}) {
  const id = String(fundId || '').trim();
  if (!id) throw new AppError('מזהה קרן חסר', 400);

  const riskCategory = risk ? normalizeRiskLevel(risk) : null;

  if (config.FINQ_ENABLED && config.FINQ_AUTH_TOKEN) {
    try {
      const payload = await finqFetch(buildFundDetailUrl(id));
      const raw = payload?.data ?? payload?.fund ?? payload;
      const normalized = normalizeFinqFund(raw, riskCategory || DEFAULT_RISK);
      if (normalized) {
        return { fund: normalized, source: 'finq', riskCategory: normalized.riskCategory };
      }
    } catch (err) {
      console.warn('[PensionService] Finq fund detail failed:', err.message);
    }
  }

  const caches = riskCategory
    ? [await readCache(riskCategory)]
    : await PensionLeadingFundCache.find({}).lean();

  for (const bucket of caches) {
    const hit = bucket?.funds?.find(f => f.id === id);
    if (hit) {
      return {
        fund: hit,
        source: 'cache_fallback',
        riskCategory: bucket.riskCategory,
        updatedAt: bucket.updatedAt,
      };
    }
  }

  throw new AppError('קרן לא נמצאה', 404);
}

/** Test helper — seed cache without Finq. */
async function seedCacheForTests(riskCategory, funds) {
  return writeCache(riskCategory, funds, { source: 'finq' });
}

/** Test helper — clear all leading-fund cache buckets. */
async function clearLeadingFundsCache() {
  await PensionLeadingFundCache.deleteMany({});
}

module.exports = {
  normalizeRiskLevel,
  normalizeFinqFund,
  getLeadingFunds,
  getFundById,
  buildLeadingFundsUrl,
  seedCacheForTests,
  clearLeadingFundsCache,
  RISK_LEVELS,
  DEFAULT_RISK,
};
