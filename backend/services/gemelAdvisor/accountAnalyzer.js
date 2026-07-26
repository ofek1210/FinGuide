'use strict';

const { FEE_CLASSIFICATION } = require('../../config/gemelAdvisorConfig');
const { median } = require('../../utils/pensionStats');

function classifyFee(userFee, benchmarkFee) {
  if (userFee == null || benchmarkFee == null) return 'insufficient_data';
  const diff = userFee - benchmarkFee;
  if (diff <= FEE_CLASSIFICATION.significantlyBelow) return 'significantly_below_average';
  if (diff <= FEE_CLASSIFICATION.below) return 'below_average';
  if (Math.abs(diff) <= FEE_CLASSIFICATION.near) return 'near_average';
  if (diff <= FEE_CLASSIFICATION.above) return 'above_average';
  return 'significantly_above_average';
}

function feeClassificationHe(cls) {
  const map = {
    significantly_below_average: 'נמוך משמעותית מהממוצע',
    below_average: 'נמוך מהממוצע',
    near_average: 'קרוב לממוצע',
    above_average: 'גבוה מהממוצע',
    significantly_above_average: 'גבוה משמעותית מהממוצע',
    insufficient_data: 'אין מספיק נתונים',
  };
  return map[cls] || cls;
}

function analyzeAccountFees(account, match, peerFunds) {
  const peerBalanceFees = peerFunds.map(p => p.managementFeeBalanceAvgPct).filter(v => v != null);
  const peerDepositFees = peerFunds.map(p => p.managementFeeDepositAvgPct).filter(v => v != null);
  const benchmarkBal = match?.matchedFund?.managementFeeBalanceAvgPct ?? median(peerBalanceFees);
  const benchmarkDep = match?.matchedFund?.managementFeeDepositAvgPct ?? median(peerDepositFees);

  const balanceClass = classifyFee(account.managementFeeBalancePct, benchmarkBal);
  const depositClass = classifyFee(account.managementFeeDepositPct, benchmarkDep);

  let possibleSavings = null;
  const assumptions = [];
  if (account.managementFeeBalancePct != null && benchmarkBal != null && account.balance > 0) {
    const annualCost = account.balance * (account.managementFeeBalancePct / 100);
    const benchmarkCost = account.balance * (benchmarkBal / 100);
    possibleSavings = Math.max(0, Math.round(annualCost - benchmarkCost));
    assumptions.push('הערכה שנתית על בסיס צבירה נוכחית — לא כוללת תשואה או הפקדות עתידיות');
  }

  const findings = [];
  if (balanceClass === 'above_average' || balanceClass === 'significantly_above_average') {
    findings.push({
      type: 'high_management_fee',
      severity: balanceClass === 'significantly_above_average' ? 'high' : 'medium',
      title: `דמי הניהול מהצבירה — ${account.fundName}`,
      explanation: `דמי הניהול מהצבירה (${account.managementFeeBalancePct}%) ${feeClassificationHe(balanceClass)} (${benchmarkBal}%).`,
      currentValue: account.managementFeeBalancePct,
      benchmarkValue: benchmarkBal,
      possibleSavings,
      confidence: match?.matchConfidence >= 70 ? 0.9 : 0.6,
      assumptions,
    });
  }

  return {
    balanceClassification: balanceClass,
    depositClassification: depositClass,
    benchmarkBalanceFee: benchmarkBal,
    benchmarkDepositFee: benchmarkDep,
    estimatedAnnualFeeCost: account.managementFeeBalancePct != null && account.balance
      ? Math.round(account.balance * (account.managementFeeBalancePct / 100))
      : null,
    findings,
  };
}

function analyzeAccountReturns(account, match, peerFunds) {
  if (!match?.matchedFund) {
    return { classification: 'insufficient_history', findings: [] };
  }

  const userRet5 = match.matchedFund.return5YearsAnnualizedPct;
  const peerRet5 = peerFunds.map(p => p.return5YearsAnnualizedPct).filter(v => v != null);
  if (userRet5 == null || !peerRet5.length) {
    return { classification: 'insufficient_history', findings: [] };
  }

  const med = median(peerRet5);
  const sorted = [...peerRet5].sort((a, b) => a - b);
  const pct = sorted.filter(v => v <= userRet5).length / sorted.length;

  let classification = 'near_peer_group';
  if (pct >= 0.9) classification = 'materially_above_peer_group';
  else if (pct >= 0.75) classification = 'above_peer_group';
  else if (pct <= 0.1) classification = 'materially_below_peer_group';
  else if (pct <= 0.25) classification = 'below_peer_group';

  const findings = [];
  if (classification === 'below_peer_group' || classification === 'materially_below_peer_group') {
    findings.push({
      type: 'low_performance',
      severity: 'medium',
      title: `ביצועים לטווח ארוך — ${account.fundName}`,
      explanation: `תשואה שנתית ממוצעת ל-5 שנים (${userRet5}%) מתחת לחציון קבוצת השוואה (${med?.toFixed(2)}%). לא מספיק לבדו להמלצה על מעבר.`,
      confidence: 0.72,
    });
  }

  return { classification, percentile: Math.round(pct * 100), findings };
}

function analyzeRiskSuitability(account, match, profile) {
  const findings = [];
  const fundRisk = match?.matchedFund?.riskLevel || 'unknown';
  const userRisk = profile.riskTolerance || 'unknown';
  const riskOrder = { low: 0, medium: 1, high: 2, unknown: 1 };

  if (profile.missingFields.includes('riskTolerance')) {
    return {
      conclusion: 'insufficient_onboarding_data',
      findings: [{
        type: 'missing_data',
        severity: 'low',
        title: 'פרופיל סיכון חסר',
        explanation: 'לא נמצאה העדפת סיכון באונבורדינג — לא ניתן להעריך התאמת מסלול.',
        confidence: 0.95,
      }],
    };
  }

  const gap = Math.abs((riskOrder[fundRisk] ?? 1) - (riskOrder[userRisk] ?? 1));
  let conclusion = 'current_risk_appears_suitable';

  if (gap >= 2) {
    conclusion = fundRisk === 'high' ? 'current_track_may_be_too_aggressive' : 'current_track_may_be_too_conservative';
    findings.push({
      type: 'risk_track_mismatch',
      severity: 'medium',
      currentRisk: fundRisk,
      suggestedRiskRange: userRisk === 'high' ? ['medium', 'high'] : ['low', 'medium'],
      explanation: `מסלול הסיכון (${fundRisk}) אינו תואם את העדפת הסיכון (${userRisk}).`,
      warnings: conclusion === 'current_track_may_be_too_aggressive'
        ? ['מסלול אגרסיבי עלול לחוות ירידות זמניות משמעותיות']
        : [],
      confidence: profile.profileConfidence,
    });
  } else if (
    fundRisk === 'low'
    && profile.investmentHorizonYears >= 10
    && !profile.needsLiquiditySoon
    && profile.canAbsorbLosses
    && ['medium', 'high'].includes(userRisk)
  ) {
    conclusion = 'investment_horizon_may_support_higher_risk';
    findings.push({
      type: 'risk_review_opportunity',
      severity: 'low',
      explanation: 'לפי הפרטים שמילאת, ייתכן שניתן לבדוק מסלולים ברמת סיכון בינונית או גבוהה יותר — רק אם אתה מוכן לתנודתיות.',
      warnings: ['תשואה גבוהה יותר מגיעה עם סיכון גבוה יותר לירידות זמניות'],
      confidence: 0.78,
    });
  }

  if (profile.needsLiquiditySoon) {
    findings.push({
      type: 'liquidity_conflict',
      severity: 'medium',
      explanation: 'זוהה צורך בנזילות — מסלולים אגרסיביים עלולים לא להתאים.',
      confidence: 0.8,
    });
  }

  return { conclusion, findings };
}

function analyzeConsolidation(accounts) {
  const opportunities = [];
  const byType = {};
  for (const a of accounts) {
    byType[a.productType] = byType[a.productType] || [];
    byType[a.productType].push(a);
  }

  for (const [type, list] of Object.entries(byType)) {
    if (list.length < 2) continue;
    const inactive = list.filter(a => a.accountStatus === 'inactive' && a.balance > 0);
    const small = list.filter(a => a.balance > 0 && a.balance < 5000);
    if (inactive.length || list.length >= 3) {
      opportunities.push({
        type: 'consolidation',
        severity: 'low',
        title: type === 'study_fund' ? 'מספר קרנות השתלמות' : 'מספר קופות גמל',
        explanation: `זוהו ${list.length} חשבונות מאותו סוג. ייתכן שיש מקום לפשט — אך יש לבדוק ניוד, מס ונזילות.`,
        blockers: ['יש לוודא תאריכי נזילות', 'יש לבדוק השלכות מס', 'יש לאמת סטטוס מעסיק'],
        accountIds: list.map(a => a.accountId),
        confidence: 0.75,
      });
    }
    if (small.length >= 2) {
      opportunities.push({
        type: 'small_dormant_accounts',
        severity: 'low',
        explanation: `${small.length} חשבונות עם צבירה נמוכה — כדאי לבדוק איחוד.`,
        accountIds: small.map(a => a.accountId),
        confidence: 0.7,
      });
    }
  }
  return opportunities;
}

module.exports = {
  analyzeAccountFees,
  analyzeAccountReturns,
  analyzeRiskSuitability,
  analyzeConsolidation,
  classifyFee,
  feeClassificationHe,
};
