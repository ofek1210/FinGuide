'use strict';

const { OFFICIAL_PROVIDER_PRIORITY } = require('../../config/gemelAdvisorConfig');

const FEE_CONFLICT_THRESHOLD = 0.05;

function providerRank(source) {
  const idx = OFFICIAL_PROVIDER_PRIORITY.indexOf(source);
  return idx >= 0 ? idx : OFFICIAL_PROVIDER_PRIORITY.length;
}

function isNewer(a, b) {
  return String(a?.reportDate || '').localeCompare(String(b?.reportDate || '')) > 0;
}

function completenessScore(fund) {
  let score = 0;
  if (fund.managementFeeBalanceAvgPct != null) score += 1;
  if (fund.managementFeeDepositAvgPct != null) score += 1;
  if (fund.return5YearsAnnualizedPct != null) score += 1;
  if (fund.return3YearsAnnualizedPct != null) score += 1;
  if (fund.volatility != null || fund.sharpeRatio != null) score += 1;
  return score;
}

function pickPreferredRecord(a, b) {
  if (isNewer(a, b)) return a;
  if (isNewer(b, a)) return b;
  const ca = completenessScore(a);
  const cb = completenessScore(b);
  if (ca !== cb) return ca > cb ? a : b;
  return providerRank(a.source) <= providerRank(b.source) ? a : b;
}

function detectFieldConflict(field, a, b) {
  const va = a[field];
  const vb = b[field];
  if (va == null || vb == null) return null;
  const diff = Math.abs(va - vb);
  if (field.includes('Fee') && diff >= FEE_CONFLICT_THRESHOLD) {
    return { field, gemelnet: a.source === 'gemelnet' ? va : b.source === 'gemelnet' ? vb : va, dataGov: a.source === 'data.gov.il' ? va : b.source === 'data.gov.il' ? vb : vb, diff };
  }
  if (field.includes('return') && diff >= 0.5) {
    return { field, values: { [a.source]: va, [b.source]: vb }, diff };
  }
  return null;
}

/**
 * Merge normalized official fund rows from multiple providers.
 * Prefer: same fund code → newer period → more complete row → provider priority.
 */
function mergeOfficialFundRecords(funds = []) {
  const byCode = new Map();
  const conflicts = [];

  for (const fund of funds) {
    if (!fund?.fundCode) continue;
    const code = String(fund.fundCode);
    const existing = byCode.get(code);
    if (!existing) {
      byCode.set(code, { ...fund, sources: [fund.source] });
      continue;
    }

    for (const field of ['managementFeeBalanceAvgPct', 'managementFeeDepositAvgPct', 'return5YearsAnnualizedPct']) {
      const conflict = detectFieldConflict(field, existing, fund);
      if (conflict) {
        conflicts.push({
          fundCode: code,
          fundName: existing.fundName || fund.fundName,
          ...conflict,
          resolution: 'newer_or_more_complete_record',
        });
      }
    }

    const preferred = pickPreferredRecord(existing, fund);
    const sources = [...new Set([...(existing.sources || [existing.source]), fund.source])];
    byCode.set(code, { ...preferred, sources });
  }

  return { funds: [...byCode.values()], conflicts };
}

module.exports = {
  mergeOfficialFundRecords,
  pickPreferredRecord,
  detectFieldConflict,
};
