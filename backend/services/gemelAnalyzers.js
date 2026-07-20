'use strict';

const { buildFinancialInsight } = require('../utils/financialInsightBuilder');
const { median, percentileRank } = require('../utils/pensionStats');
const pensionConfig = require('../config/pensionAnalysisConfig');
const advisoryConfig = require('../config/financialAdvisoryConfig');

function feePercent(fee) {
  if (fee == null) return null;
  return fee <= 0.05 ? fee * 100 : fee;
}

function productTypeForFund(fund) {
  return fund.fundType === 'study_fund' ? 'HISHTALMUT' : 'GEMEL';
}

function analyzeGemelFees(fund, ctx) {
  const { productMatch, peerGroup } = ctx;
  if (!productMatch?.allowPeerRanking || peerGroup.size < pensionConfig.minPeerGroupSize) return [];

  const userAsset = feePercent(fund.managementFeeAccumulation);
  const userDeposit = feePercent(fund.managementFeeDeposit);
  const peerAssetFees = peerGroup.peers.map(p => p.assetFee).filter(v => v != null);
  const peerDepositFees = peerGroup.peers.map(p => p.depositFee).filter(v => v != null);
  if (!peerAssetFees.length && !peerDepositFees.length) return [];

  const insights = [];
  const pt = productTypeForFund(fund);

  if (userAsset != null && peerAssetFees.length) {
    const med = median(peerAssetFees);
    const pct = percentileRank(userAsset, peerAssetFees);
    if (pct != null && pct >= 70) {
      const annualImpact = Math.round((fund.currentBalance || 0) * ((userAsset - med) / 100));
      insights.push(buildFinancialInsight({
        code: 'high_asset_management_fee',
        productType: pt,
        category: 'fees',
        severity: pct >= 85 ? 'high' : 'medium',
        priority: 25,
        title: `דמי ניהול מצבירה — ${fund.fundName}`,
        reason: `דמי הניהול מצבירה (${userAsset.toFixed(2)}%) גבוהים מחציון קבוצת השוואה (${med?.toFixed(2)}%) — אחוזון ${pct}.`,
        suggestedAction: 'כדאי לבדוק מול הגוף המנהל האם ניתן לשפר את תנאי דמי הניהול.',
        evidence: { userAssetFee: userAsset, peerMedianAssetFee: med, percentile: pct, benchmark: { group: peerGroup.groupKey } },
        financialImpact: annualImpact > 0 ? { amount: annualImpact, period: 'annual', assumptions: ['הערכה על בסיס צבירה נוכחית'] } : undefined,
        confidence: 0.78,
        productId: ctx.fundId,
        productName: fund.fundName,
        sources: ['user.fund', 'gemel_net.peer_group'],
        analyzerName: 'analyzeGemelFees',
      }));
    }
  }

  if (userDeposit != null && peerDepositFees.length) {
    const med = median(peerDepositFees);
    const pct = percentileRank(userDeposit, peerDepositFees);
    if (pct != null && pct >= 70) {
      insights.push(buildFinancialInsight({
        code: 'high_deposit_management_fee',
        productType: pt,
        category: 'fees',
        severity: 'medium',
        priority: 28,
        title: `דמי ניהול מהפקדה — ${fund.fundName}`,
        reason: `דמי הניהול מהפקדה (${userDeposit.toFixed(2)}%) גבוהים מחציון קבוצת השוואה (${med?.toFixed(2)}%).`,
        suggestedAction: 'כדאי לבדוק את תנאי דמי הניהול מהפקדה מול הגוף המנהל.',
        evidence: { userDepositFee: userDeposit, peerMedianDepositFee: med, percentile: pct },
        confidence: 0.75,
        productId: ctx.fundId,
        productName: fund.fundName,
        sources: ['user.fund', 'gemel_net.peer_group'],
        analyzerName: 'analyzeGemelFees',
      }));
    }
  }

  return insights;
}

function analyzeGemelPerformance(fund, ctx) {
  const { match, peerGroup, productMatch } = ctx;
  if (!productMatch?.allowPeerRanking || !match || peerGroup.size < pensionConfig.minPeerGroupSize) return [];

  const peerReturns5Y = peerGroup.peers.map(p => p.return5Y).filter(v => v != null);
  const userReturn5Y = fund.historicalReturn5Y ?? match.return5Y;
  if (userReturn5Y == null || !peerReturns5Y.length) return [];

  const pct = percentileRank(userReturn5Y, peerReturns5Y);
  const med = median(peerReturns5Y);
  const pt = productTypeForFund(fund);

  if (pct == null) return [];
  if (pct >= 40) return [];

  return [buildFinancialInsight({
    code: 'long_term_underperformance',
    productType: pt,
    category: 'performance',
    severity: pct < 25 ? 'medium' : 'low',
    priority: 35,
    title: `ביצועים לטווח ארוך — ${fund.fundName}`,
    reason: `תשואה ל-5 שנים (${userReturn5Y}%) מתחת לחציון קבוצת השוואה (${med?.toFixed(2)}%) — אחוזון ${pct}. לא מספיק לבדו כדי להמליץ על מעבר.`,
    suggestedAction: 'כדאי לעקוב אחרי הביצועים לאורך זמן ולבדוק התאמה למסלול ההשקעה.',
    evidence: { return5Y: userReturn5Y, peerMedian5Y: med, percentile: pct, benchmark: { group: peerGroup.groupKey } },
    confidence: 0.72,
    productId: ctx.fundId,
    productName: fund.fundName,
    sources: ['user.fund', 'gemel_net.TSUA_5Y'],
    analyzerName: 'analyzeGemelPerformance',
  })];
}

function classifyLiquidity(fund, userContext) {
  if (fund.fundType !== 'study_fund') {
    return { status: 'not_applicable', label: 'לא רלוונטי לקופת גמל' };
  }
  const raw = fund.rawData || {};
  const liquidityDate = raw.liquidityDate || raw.expectedLiquidityDate || null;
  if (liquidityDate) {
    const d = new Date(liquidityDate);
    if (!Number.isNaN(d.getTime())) {
      return d <= new Date()
        ? { status: 'liquid', label: 'נזילה', liquidityDate: d.toISOString().slice(0, 10) }
        : { status: 'not_yet_liquid', label: 'טרם נזילה', liquidityDate: d.toISOString().slice(0, 10) };
    }
  }
  return { status: 'unknown', label: 'סטטוס נזילות לא ידוע' };
}

function analyzeGemelLiquidity(fund, ctx) {
  if (fund.fundType !== 'study_fund') return [];
  const liq = classifyLiquidity(fund, ctx.userContext);
  if (liq.status === 'unknown') {
    return [buildFinancialInsight({
      code: 'liquidity_status_unknown',
      productType: 'HISHTALMUT',
      category: 'liquidity',
      severity: 'info',
      priority: 55,
      title: `סטטוס נזילות — ${fund.fundName}`,
      reason: 'לא נמצא מידע על תאריך נזילות בדוח. לא ניתן לקבוע האם הקרן נזילה.',
      suggestedAction: 'בדוק בדוח המסלקה או מול הגוף המנהל את תאריך הנזילות.',
      evidence: { liquidityStatus: liq.status },
      confidence: 0.6,
      productId: ctx.fundId,
      productName: fund.fundName,
      sources: ['user.fund'],
      analyzerName: 'analyzeGemelLiquidity',
    })];
  }
  if (liq.status === 'liquid') {
    return [buildFinancialInsight({
      code: 'study_fund_liquid',
      productType: 'HISHTALMUT',
      category: 'liquidity',
      severity: 'info',
      priority: 50,
      title: `קרן השתלמות נזילה — ${fund.fundName}`,
      reason: `הקרן מסומנת כנזילה${liq.liquidityDate ? ` (נכון ל-${liq.liquidityDate})` : ''}. נזילות אינה מהווה המלצה למשיכה.`,
      suggestedAction: 'לפני כל פעולה, בדוק השלכות מס ותנאי משיכה מול הגוף המנהל.',
      evidence: { liquidityStatus: liq.status, liquidityDate: liq.liquidityDate },
      confidence: 0.7,
      productId: ctx.fundId,
      productName: fund.fundName,
      sources: ['user.fund'],
      analyzerName: 'analyzeGemelLiquidity',
    })];
  }
  return [];
}

function analyzeGemelInactive(fund, ctx) {
  const inactive = fund.isActive === false || fund.activityStatus === 'INACTIVE' || fund.status === 'closed';
  if (!inactive) return [];

  const balance = fund.currentBalance || 0;
  const pt = productTypeForFund(fund);
  const severity = balance >= advisoryConfig.smallInactiveBalanceThreshold ? 'medium' : 'low';

  return [buildFinancialInsight({
    code: 'inactive_product_with_balance',
    productType: pt,
    category: 'account_structure',
    severity,
    priority: 30,
    title: `מוצר לא פעיל — ${fund.fundName}`,
    reason: `המוצר מסומן כלא פעיל עם צבירה של ₪${balance.toLocaleString('he-IL')}.`,
    suggestedAction: 'לפני איחוד או שינוי — בדוק עם הגוף המנהל את תנאי הניוד והמיסוי.',
    evidence: { balance, activityStatus: fund.activityStatus, isActive: fund.isActive },
    confidence: 0.85,
    productId: ctx.fundId,
    productName: fund.fundName,
    sources: ['user.fund'],
    analyzerName: 'analyzeGemelInactive',
  })];
}

function analyzeGemelDeposits(fund, ctx) {
  const monthly = (fund.monthlyEmployeeDeposit || 0) + (fund.monthlyEmployerDeposit || 0)
    || fund.monthlyDeposit || 0;
  const active = fund.isActive !== false && fund.activityStatus !== 'INACTIVE';
  const balance = fund.currentBalance || 0;
  const pt = productTypeForFund(fund);

  if (active && balance > 0 && monthly === 0) {
    return [buildFinancialInsight({
      code: 'balance_without_recent_deposits',
      productType: pt,
      category: 'deposits',
      severity: 'medium',
      priority: 15,
      title: `צבירה ללא הפקדות — ${fund.fundName}`,
      reason: `קיימת צבירה (₪${balance.toLocaleString('he-IL')}) אך לא זוהו הפקדות חודשיות בדוח.`,
      suggestedAction: 'בדוק האם ההפקדות ממשיכות דרך מעסיק אחר או שהמוצר הופסק.',
      evidence: { balance, monthlyDeposits: monthly },
      confidence: 0.8,
      productId: ctx.fundId,
      productName: fund.fundName,
      sources: ['user.fund'],
      analyzerName: 'analyzeGemelDeposits',
    })];
  }
  return [];
}

function analyzeGemelRiskFit(fund, ctx) {
  const userRisk = ctx.userContext?.risk?.effective;
  const fundRisk = fund.riskLevel;
  if (!userRisk || !fundRisk) return [];

  const order = { low: 0, medium: 1, high: 2 };
  const gap = Math.abs((order[userRisk] ?? 1) - (order[fundRisk] ?? 1));
  if (gap < 2) return [];

  const pt = productTypeForFund(fund);
  return [buildFinancialInsight({
    code: 'risk_profile_mismatch',
    productType: pt,
    category: 'risk',
    severity: 'medium',
    priority: 22,
    title: `התאמת סיכון — ${fund.fundName}`,
    reason: `מסלול הסיכון (${fundRisk}) אינו תואם את העדפת הסיכון מהאונבורדינג (${userRisk}).`,
    suggestedAction: 'כדאי לבדוק עם בעל רישיון האם מסלול ההשקעה מתאים לפרופילך.',
    evidence: { fundRisk, userRisk, investmentTrack: fund.investmentTrack },
    confidence: 0.7,
    productId: ctx.fundId,
    productName: fund.fundName,
    sources: ['user.fund', 'user.onboarding'],
    analyzerName: 'analyzeGemelRiskFit',
  })];
}

function analyzeGemelDataQuality(fund, ctx) {
  const { productMatch } = ctx;
  if (productMatch?.matchConfidence >= advisoryConfig.matchConfidence.acceptableMin) return [];

  const pt = productTypeForFund(fund);
  return [buildFinancialInsight({
    code: 'weak_market_match',
    productType: pt,
    category: 'data_quality',
    severity: 'info',
    priority: 5,
    title: `התאמת שוק — ${fund.fundName}`,
    reason: `התאמה לנתוני גמל-נט חלשה (ביטחון ${productMatch?.matchConfidence ?? 0}%). השוואה לשוק מוגבלת.`,
    suggestedAction: 'וודא ששם המוצר והגוף המנהל בדוח תואמים לנתוני השוק.',
    evidence: { matchConfidence: productMatch?.matchConfidence, matchMethod: productMatch?.matchMethod },
    confidence: 0.9,
    productId: ctx.fundId,
    productName: fund.fundName,
    sources: ['gemel_net.match'],
    analyzerName: 'analyzeGemelDataQuality',
  })];
}

function analyzeGemelFragmentation(funds, productTypeFilter) {
  const filtered = funds.filter(f => productTypeFilter(f));
  if (filtered.length < 2) return [];

  const pt = filtered[0].fundType === 'study_fund' ? 'HISHTALMUT' : 'GEMEL';
  const totalBalance = filtered.reduce((s, f) => s + (f.currentBalance || 0), 0);

  return [buildFinancialInsight({
    code: 'fragmented_accounts',
    productType: pt,
    category: 'account_structure',
    severity: 'low',
    priority: 40,
    title: pt === 'HISHTALMUT' ? 'מספר קרנות השתלמות' : 'מספר קופות גמל',
    reason: `זוהו ${filtered.length} מוצרים מאותו סוג עם צבירה כוללת של ₪${totalBalance.toLocaleString('he-IL')}.`,
    suggestedAction: 'כדאי לבדוק האם ניתן לפשט את מבנה החשבונות — לפני פעולה, בדוק תנאי ניוד.',
    evidence: { accountCount: filtered.length, totalBalance },
    confidence: 0.75,
    sources: ['user.funds'],
    analyzerName: 'analyzeGemelFragmentation',
  })];
}

module.exports = {
  analyzeGemelFees,
  analyzeGemelPerformance,
  analyzeGemelLiquidity,
  analyzeGemelInactive,
  analyzeGemelDeposits,
  analyzeGemelRiskFit,
  analyzeGemelDataQuality,
  analyzeGemelFragmentation,
  classifyLiquidity,
  productTypeForFund,
};
