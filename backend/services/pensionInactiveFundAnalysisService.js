'use strict';

const { buildPensionInsight } = require('../utils/pensionInsightBuilder');
const config = require('../config/pensionAnalysisConfig');
const { feeAsDecimal } = require('./pensionFeeAnalysisService');

/**
 * Deliverable #9 — inactive / duplicate fund detection (no auto-consolidate).
 */
function analyzeInactiveFunds(funds, userContext) {
  if (!funds?.length) return [];

  const insights = [];
  const activeFunds = funds.filter(f => f.isActive !== false && f.status !== 'closed');
  const inactiveFunds = funds.filter(f => f.isActive === false || f.status === 'closed');

  for (const fund of inactiveFunds) {
    const balance = fund.currentBalance ?? 0;
    const hasDeposits = (fund.monthlyDeposit ?? 0) > 0
      || (fund.monthlyEmployeeDeposit ?? 0) > 0;

    if (hasDeposits) continue;

    const assetFee = feeAsDecimal(fund.managementFeeAccumulation);
    const isSmall = balance > 0 && balance < config.smallInactiveBalanceThreshold;
    const highFee = assetFee != null && assetFee >= 0.005;

    if (!isSmall && !highFee && balance <= 0) continue;

    let finding = `נמצאה קרן "${fund.fundName}" (${fund.provider || '—'}) שאינה מקבלת הפקדות.`;
    if (balance > 0) finding += ` יתרה: ₪${balance.toLocaleString('he-IL')}.`;
    if (highFee && assetFee != null) {
      finding += ` דמי ניהול מצבירה ${(assetFee * 100).toFixed(2)}%.`;
    }

    insights.push(buildPensionInsight({
      category: 'inactive_fund',
      severity: highFee ? 'medium' : 'low',
      title: `קרן ללא הפקדות — ${fund.fundName}`,
      finding,
      personalDataUsed: ['fund.isActive', 'fund.currentBalance', 'fund.managementFeeAccumulation'],
      marketDataUsed: [],
      recommendedAction: 'לפני איחוד מומלץ לבדוק תנאים ביטוחיים, תקופת אכשרה וזכויות קיימות, לאחר התייעצות עם בעל רישיון.',
      confidence: 0.85,
      fundId: fund._id?.toString?.() || fund.id,
      legacyType: 'inactive_fund',
      impactAmount: highFee ? Math.round(balance * (assetFee || 0)) : 0,
    }));
  }

  const byProvider = {};
  for (const f of funds) {
    const key = String(f.provider || 'unknown').trim();
    byProvider[key] = (byProvider[key] || 0) + 1;
  }
  for (const [provider, count] of Object.entries(byProvider)) {
    if (count >= 3) {
      insights.push(buildPensionInsight({
        category: 'inactive_fund',
        severity: 'info',
        title: `מספר קרנות ב${provider}`,
        finding: `זוהו ${count} קרנות/מוצרים אצל ${provider}. ייתכן פיזור או כפילות.`,
        personalDataUsed: ['fund.provider'],
        marketDataUsed: [],
        recommendedAction: 'מומלץ לבדוק עם בעל רישיון האם יש צורך באיחוד — לא מומלץ איחוד אוטומטי.',
        confidence: 0.7,
        legacyType: 'multiple_funds_same_provider',
      }));
    }
  }

  const byType = {};
  for (const f of activeFunds.concat(inactiveFunds)) {
    byType[f.fundType] = (byType[f.fundType] || 0) + 1;
  }
  if ((byType.pension_comprehensive || 0) + (byType.pension_old || 0) > 2) {
    insights.push(buildPensionInsight({
      category: 'inactive_fund',
      severity: 'info',
      title: 'מספר קרנות פנסיה',
      finding: `זוהו ${(byType.pension_comprehensive || 0) + (byType.pension_old || 0)} קרנות פנסיה — כדאי לבדוק איחוד.`,
      personalDataUsed: ['fund.fundType'],
      marketDataUsed: [],
      recommendedAction: 'לפני איחוד — בדוק זכויות ותקופות אכשרה עם בעל רישיון.',
      confidence: 0.75,
      legacyType: 'multiple_pension_funds',
    }));
  }

  void userContext;
  return insights;
}

module.exports = { analyzeInactiveFunds };
