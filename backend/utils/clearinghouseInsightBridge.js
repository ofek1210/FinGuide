'use strict';

const { buildFinancialInsight } = require('./financialInsightBuilder');

const CLEARINGHOUSE_PENSION_TYPES = new Set([
  'clearinghouse_small_inactive_pension',
  'clearinghouse_active_fee_benchmark',
]);

const CLEARINGHOUSE_GEMEL_TYPES = new Set([
  'clearinghouse_high_fee_inactive_provident',
]);

function filterClearinghouseRecsByDomain(recs, domain) {
  const list = recs || [];
  if (domain === 'pension') {
    return list.filter(r => CLEARINGHOUSE_PENSION_TYPES.has(r.type));
  }
  if (domain === 'gemel') {
    return list.filter(r => CLEARINGHOUSE_GEMEL_TYPES.has(r.type));
  }
  return list;
}

function productTypeForClearinghouseRec(rec) {
  if (rec?.type === 'clearinghouse_high_fee_inactive_provident') return 'GEMEL';
  return 'PENSION';
}

function companyFromRec(rec) {
  const text = `${rec.title || ''} ${rec.reason || ''}`;
  if (rec.type === 'clearinghouse_small_inactive_pension') {
    if (/מיטב/i.test(text)) return 'meitav';
    if (/כלל/i.test(text)) return 'clal';
    if (/הראל/i.test(text)) return 'harel';
  }
  if (/הראל/i.test(text)) return 'harel';
  if (/כלל/i.test(text)) return 'clal';
  if (/מיטב/i.test(text)) return 'meitav';
  return 'clearinghouse';
}

function matchFundForRec(funds, rec) {
  const key = companyFromRec(rec);
  return funds.find(f => {
    const p = String(f.provider || '');
    if (key === 'harel') return /הראל/i.test(p);
    if (key === 'clal') return /כלל/i.test(p);
    if (key === 'meitav') return /מיטב/i.test(p);
    return false;
  }) || null;
}

function suggestedActionFor(rec) {
  if (rec.type === 'clearinghouse_small_inactive_pension') {
    return 'כדאי לבדוק איחוד (ניוד) אל הקרן הפעילה, לאחר התייעצות עם בעל רישיון.';
  }
  if (rec.type === 'clearinghouse_high_fee_inactive_provident') {
    return 'כדאי לפנות לגוף המנהל להורדת התעריף או לשקול ניוד לקרן עם דמי ניהול נמוכים יותר.';
  }
  if (rec.type === 'clearinghouse_active_fee_benchmark') {
    return 'כדאי לפנות לגוף המנהל ולבדוק אם ניתן לשפר את התנאים.';
  }
  return 'כדאי לבדוק מול בעל רישיון.';
}

/**
 * Convert clearinghouse legacy recommendations into unified financial insights
 * for the shared advisory prioritizer + LLM formatter.
 */
function fromClearinghouseRecommendation(rec, index, fund = null) {
  if (!rec?.type) return null;

  if (rec.type === 'clearinghouse_active_fee_benchmark' && rec.urgency === 'low') {
    return null;
  }

  const codeByType = {
    clearinghouse_small_inactive_pension: 'inactive_fund',
    clearinghouse_high_fee_inactive_provident: 'high_asset_management_fee',
    clearinghouse_active_fee_benchmark: 'fee_cost_projection',
  };

  const severity = rec.urgency === 'high'
    ? 'high'
    : rec.urgency === 'medium'
      ? 'medium'
      : rec.urgency === 'low'
        ? 'low'
        : 'info';

  const productId = fund?._id?.toString?.() || `${companyFromRec(rec)}:${rec.type}`;

  return buildFinancialInsight({
    id: `clearinghouse-${rec.type}-${index}`,
    code: codeByType[rec.type] || rec.type,
    legacyType: rec.type,
    productType: productTypeForClearinghouseRec(rec),
    productId,
    productName: fund?.fundName || rec.title,
    category: rec.type.includes('fee') || rec.type.includes('provident') ? 'fees' : 'account_structure',
    severity: rec.type === 'clearinghouse_high_fee_inactive_provident' ? 'high' : severity,
    priority: rec.urgency === 'high' ? 10 : rec.urgency === 'medium' ? 25 : 50,
    title: rec.title,
    reason: rec.reason,
    suggestedAction: suggestedActionFor(rec),
    confidence: (rec.confidenceScore ?? 85) / 100,
    sources: ['clearinghouse'],
    analyzerName: 'clearinghouseRules',
    financialImpact: rec.impactAmount
      ? { amount: rec.impactAmount, currency: 'ILS', period: 'retirement' }
      : null,
    evidence: {
      clearinghouseType: rec.type,
      companyKey: companyFromRec(rec),
    },
  });
}

function clearinghouseRecsToUnifiedInsights(recs, funds = [], options = {}) {
  const filtered = options.domain
    ? filterClearinghouseRecsByDomain(recs, options.domain)
    : (recs || []);
  return filtered
    .map((rec, index) => fromClearinghouseRecommendation(rec, index, matchFundForRec(funds, rec)))
    .filter(Boolean);
}

module.exports = {
  fromClearinghouseRecommendation,
  clearinghouseRecsToUnifiedInsights,
  filterClearinghouseRecsByDomain,
  productTypeForClearinghouseRec,
  CLEARINGHOUSE_PENSION_TYPES,
  CLEARINGHOUSE_GEMEL_TYPES,
  companyFromRec,
};
