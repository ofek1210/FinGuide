'use strict';

const { emptyMatchResult } = require('./schemas');
const { MIN_FUZZY_CONFIDENCE } = require('../../config/gemelAdvisorConfig');

const LEGAL_SUFFIXES = /\b(בע"?מ|בעמ| ltd| inc| corp| חברה לביטוח)\b/gi;
const NOISE_WORDS = /\b(קרן|קופת|גמל|השתלמות|מסלול|track|fund)\b/gi;

function normalizeMatchText(text) {
  return String(text || '')
    .toLowerCase()
    .replace(LEGAL_SUFFIXES, '')
    .replace(/[^\w\u0590-\u05FF\s]/g, ' ')
    .replace(NOISE_WORDS, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenOverlap(a, b) {
  const ta = new Set(normalizeMatchText(a).split(' ').filter(Boolean));
  const tb = new Set(normalizeMatchText(b).split(' ').filter(Boolean));
  if (!ta.size || !tb.size) return 0;
  let overlap = 0;
  for (const t of ta) if (tb.has(t)) overlap += 1;
  return overlap / Math.max(ta.size, tb.size);
}

function resolveOfficialConflict(candidates) {
  if (!candidates.length) return null;
  if (candidates.length === 1) return candidates[0];
  const sorted = [...candidates].sort((a, b) => {
    const pa = String(a.reportDate || '');
    const pb = String(b.reportDate || '');
    return pb.localeCompare(pa);
  });
  return sorted[0];
}

/**
 * Match user account to official funds.
 * @param {object} account
 * @param {object[]} officialFunds - normalized official rows
 */
function matchAccountToOfficial(account, officialFunds) {
  const warnings = [];

  if (account.fundCode) {
    const exact = officialFunds.filter(f => f.fundCode === String(account.fundCode));
    if (exact.length) {
      const best = resolveOfficialConflict(exact);
      return emptyMatchResult({
        matchMethod: 'fund_code',
        matchConfidence: 98,
        matchedFundCode: best.fundCode,
        matchedFund: best,
        warnings: exact.length > 1 ? ['נמצאו מספר רשומות רשמיות לאותו קוד — נבחרה התקופה העדכנית'] : [],
      });
    }
    warnings.push('קוד קרן לא נמצא בנתוני השוק');
  }

  const sameProduct = officialFunds.filter(f => {
    if (account.productType === 'study_fund') return f.productType === 'study_fund';
    if (account.productType === 'gemel' || account.productType === 'investment_gemel') {
      return f.productType === 'gemel' || f.productType === 'investment_gemel';
    }
    return true;
  });

  const companyNorm = normalizeMatchText(account.companyName);
  const nameNorm = normalizeMatchText(account.fundName);
  const trackNorm = normalizeMatchText(account.trackName);

  let best = null;
  let bestScore = 0;
  let bestMethod = 'no_match';

  for (const fund of sameProduct) {
    const fundCompany = normalizeMatchText(fund.companyName);
    const fundName = normalizeMatchText(fund.fundName);
    const fundTrack = normalizeMatchText(fund.trackName);

    if (companyNorm && fundCompany === companyNorm && nameNorm && fundName === nameNorm) {
      return emptyMatchResult({
        matchMethod: 'exact_name',
        matchConfidence: 95,
        matchedFundCode: fund.fundCode,
        matchedFund: fund,
        warnings,
      });
    }

    let score = 0;
    if (companyNorm && fundCompany.includes(companyNorm.split(' ')[0])) score += 0.35;
    if (nameNorm && tokenOverlap(nameNorm, fundName) >= 0.5) score += 0.35;
    if (trackNorm && fundTrack && tokenOverlap(trackNorm, fundTrack) >= 0.4) score += 0.2;
    if (score > bestScore) {
      bestScore = score;
      best = fund;
      bestMethod = score >= 0.6 ? 'normalized_name' : 'fuzzy';
    }
  }

  const confidence = Math.round(Math.min(1, bestScore) * 100);
  if (!best || confidence < MIN_FUZZY_CONFIDENCE) {
    return emptyMatchResult({
      matchMethod: 'no_match',
      matchConfidence: confidence,
      matchedFundCode: null,
      warnings: [...warnings, 'לא נמצאה התאמה מספיק בטוחה לנתוני השוק — נדרשת בדיקה ידנית'],
    });
  }

  if (bestMethod === 'fuzzy') {
    warnings.push('התאמה לשוק בוצעה בהשוואת שמות — מומלץ לאמת ידנית');
  }

  return emptyMatchResult({
    matchMethod: bestMethod,
    matchConfidence: confidence,
    matchedFundCode: best.fundCode,
    matchedFund: best,
    warnings,
  });
}

module.exports = {
  matchAccountToOfficial,
  normalizeMatchText,
  resolveOfficialConflict,
};
