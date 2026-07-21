'use strict';

const PensiaNetFund = require('../../models/PensiaNetFund');
const GemelNetFund = require('../../models/GemelNetFund');
const { getLatestSyncMeta } = require('../govCkanIngestionService');
const config = require('../../config/financialAdvisoryConfig');

const MARKET_SOURCES = {
  PENSION: { model: PensiaNetFund, source: 'PENSION_NET', label: 'פנסיה-נט' },
  GEMEL: { model: GemelNetFund, source: 'GEMEL_NET', label: 'גמל-נט' },
  HISHTALMUT: { model: GemelNetFund, source: 'GEMEL_NET', label: 'גמל-נט' },
};

function isStale(lastSyncedAt) {
  if (!lastSyncedAt) return true;
  const ageMs = Date.now() - new Date(lastSyncedAt).getTime();
  return ageMs > config.marketDataStaleDays * 24 * 60 * 60 * 1000;
}

/**
 * @param {'PENSION'|'GEMEL'|'HISHTALMUT'} productType
 * @returns {Promise<object>}
 */
async function getMarketDataMeta(productType) {
  const entry = MARKET_SOURCES[productType] || MARKET_SOURCES.PENSION;
  const meta = await getLatestSyncMeta(entry.model);
  const lastSyncedAt = meta.lastSyncedAt ? new Date(meta.lastSyncedAt).toISOString() : null;
  const reportPeriod = meta.latestReportPeriod != null
    ? String(meta.latestReportPeriod)
    : null;

  return {
    source: entry.source,
    sourceLabel: entry.label,
    latestReportPeriod: reportPeriod,
    lastSyncedAt,
    isStale: isStale(meta.lastSyncedAt),
    fundCount: meta.fundCount ?? null,
    warnings: [],
  };
}

/**
 * Attach warnings when market data insufficient.
 */
function enrichMarketWarnings(marketMeta, matchResults = []) {
  const warnings = [...(marketMeta.warnings || [])];
  if (!marketMeta.lastSyncedAt) {
    warnings.push(`מאגר ${marketMeta.sourceLabel} ריק — יש להריץ סנכרון שוק לפני השוואה מלאה.`);
  } else if (marketMeta.isStale) {
    warnings.push(`נתוני ${marketMeta.sourceLabel} אינם מעודכנים (מעל ${config.marketDataStaleDays} יום).`);
  }

  const lowMatches = matchResults.filter(m => m.matchConfidence != null && m.matchConfidence < config.matchConfidence.peerRankingMin);
  if (lowMatches.length) {
    warnings.push(`${lowMatches.length} מוצרים עם התאמת שוק חלשה — דירוג מול קבוצת השוואה מוגבל.`);
  }

  return { ...marketMeta, warnings };
}

module.exports = {
  getMarketDataMeta,
  enrichMarketWarnings,
  isStale,
};
