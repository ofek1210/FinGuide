'use strict';

const PensionDeposit = require('../models/PensionDeposit');
const { buildPensionInsight } = require('../utils/pensionInsightBuilder');
const config = require('../config/pensionAnalysisConfig');

function parseSalaryMonth(sm) {
  if (!sm) return null;
  const m = String(sm).match(/(\d{4})[-/](\d{1,2})/);
  if (!m) return null;
  return { year: Number(m[1]), month: Number(m[2]) };
}

function monthKey({ year, month }) {
  return year * 12 + month;
}

/**
 * Deliverable #10 — contribution continuity from clearinghouse deposit history.
 */
async function analyzeContributions(userId, funds, userContext) {
  const insights = [];
  const deposits = await PensionDeposit.find({ user: userId })
    .sort({ salaryMonth: -1 })
    .limit(24)
    .lean();

  if (deposits.length < config.minDepositHistoryMonths) {
    return insights;
  }

  const byFund = {};
  for (const d of deposits) {
    const key = d.fund?.toString?.() || d.accountNumber || 'unknown';
    if (!byFund[key]) byFund[key] = [];
    byFund[key].push(d);
  }

  for (const fund of funds || []) {
    const fundId = fund._id?.toString?.();
    const key = fundId || fund.accountNumber;
    const history = byFund[key] || byFund[fund.accountNumber] || [];
    if (history.length < config.minDepositHistoryMonths) continue;

    const totals = history.map(d =>
      (d.employeeDeposit || 0) + (d.employerDeposit || 0) + (d.severanceDeposit || 0),
    );
    const recent = totals.slice(0, 3);
    const older = totals.slice(3);
    const recentAvg = recent.reduce((s, v) => s + v, 0) / recent.length;
    const olderAvg = older.length ? older.reduce((s, v) => s + v, 0) / older.length : recentAvg;

    if (olderAvg > 0 && recentAvg < olderAvg * (1 - config.depositDropThreshold)) {
      insights.push(buildPensionInsight({
        category: 'contribution_gap',
        severity: 'medium',
        title: `ירידה בהפקדות — ${fund.fundName}`,
        finding: `סכום ההפקדה החודשי ירד ב-${Math.round((1 - recentAvg / olderAvg) * 100)}% לעומת הממוצע הקודם.`,
        personalDataUsed: ['pension_deposits.history'],
        marketDataUsed: [],
        recommendedAction: 'מומלץ לבדוק מול המעסיק האם יש שינוי בשכר, שעות או הפסקת הפקדות.',
        confidence: 0.8,
        fundId: fundId,
        legacyType: 'deposit_drop',
      }));
    }

    const months = history
      .map(d => parseSalaryMonth(d.salaryMonth))
      .filter(Boolean)
      .sort((a, b) => monthKey(b) - monthKey(a));

    if (months.length >= 2) {
      const gaps = [];
      for (let i = 0; i < months.length - 1; i += 1) {
        const diff = monthKey(months[i]) - monthKey(months[i + 1]);
        if (diff > 1) gaps.push(diff - 1);
      }
      if (gaps.length > 0) {
        insights.push(buildPensionInsight({
          category: 'contribution_gap',
          severity: 'medium',
          title: `הפקדות לא רציפות — ${fund.fundName}`,
          finding: `זוהו ${gaps.length} פער(ים) בהפקדות בחודשים האחרונים.`,
          personalDataUsed: ['pension_deposits.history'],
          marketDataUsed: [],
          recommendedAction: 'ייתכן שינוי מעסיק או הפסקת הפקדות — מומלץ לבדוק מול המעסיק.',
          confidence: 0.75,
          fundId: fundId,
          legacyType: 'deposit_gaps',
        }));
      }
    }

    const lastMonth = history[0];
    const emp = lastMonth?.employeeDeposit ?? 0;
    const empl = lastMonth?.employerDeposit ?? 0;
    const gross = userContext?.employment?.grossSalary;
    if (gross && gross > 0 && emp + empl > 0) {
      const expectedMin = gross * 0.185;
      const ratio = (emp + empl) / expectedMin;
      if (ratio < 0.7) {
        insights.push(buildPensionInsight({
          category: 'contribution_gap',
          severity: 'medium',
          title: `הפקדות נמוכות מהצפוי — ${fund.fundName}`,
          finding: `הפקדות עובד+מעסיק ₪${Math.round(emp + empl).toLocaleString('he-IL')} — `
            + `כ-${Math.round(ratio * 100)}% מהמינימום הצפוי (~20% מהברוטו).`,
          personalDataUsed: ['pension_deposits.history', 'profile.employment.grossSalary'],
          marketDataUsed: [],
          recommendedAction: 'מומלץ לבדוק מול המעסיק את שיעורי ההפקדה.',
          confidence: 0.7,
          fundId: fundId,
          legacyType: 'deposit_below_expected',
        }));
      }
    }
  }

  return insights;
}

module.exports = { analyzeContributions };
