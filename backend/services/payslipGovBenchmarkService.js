'use strict';

/**
 * Payslip × gov market benchmarks — pension/gemel contribution vs fund fees.
 */
const Document = require('../models/Document');
const UserProfile = require('../models/UserProfile');
const { getPensionSummary } = require('../ai/tools/pensionTools');
const { buildGemelMarketAdvice } = require('./gemelNetAdvisorService');
const { buildFundAdvice } = require('./pensionFundAdvisorService');
const { comparePensionProducts } = require('./pensionComparisonEngine');

const MIN_LEGAL_PENSION_RATE = 6;

async function getLatestPayslipContribution(userId) {
  const doc = await Document.findOne({
    user: userId,
    status: 'completed',
    'metadata.category': 'payslip',
  }).sort({ 'metadata.periodYear': -1, 'metadata.periodMonth': -1 }).lean();

  if (!doc?.analysisData) return null;

  const ad = doc.analysisData;
  const gross = ad.salary?.gross_total ?? ad.summary?.gross_total ?? null;
  const pensionEmployee = ad.contributions?.pension_employee
    ?? ad.deductions?.pension_employee
    ?? null;
  const studyFund = ad.contributions?.study_fund_employee
    ?? ad.deductions?.study_fund
    ?? null;

  let pensionRate = null;
  if (gross > 0 && pensionEmployee != null) {
    pensionRate = Math.round((pensionEmployee / gross) * 1000) / 10;
  }

  return {
    period: ad.period,
    gross,
    pensionEmployee,
    studyFundEmployee: studyFund,
    pensionRate,
    documentId: doc._id.toString(),
  };
}

async function buildPayslipGovBenchmarkRecommendations(userId) {
  const recommendations = [];
  const [payslip, summary, profile] = await Promise.all([
    getLatestPayslipContribution(userId),
    getPensionSummary(userId),
    UserProfile.findOne({ user: userId }).lean(),
  ]);

  if (!payslip) return recommendations;

  if (payslip.pensionRate != null && payslip.pensionRate < MIN_LEGAL_PENSION_RATE) {
    recommendations.push({
      type: 'pension_contribution_below_legal',
      title: 'הפרשה לפנסיה מתחת לרף החוקי',
      reason: `שיעור ההפרשה לפנסיה (${payslip.pensionRate}%) נמוך מהרף ${MIN_LEGAL_PENSION_RATE}% — בדוק עם המעסיק.`,
      urgency: 'high',
      financialImpact: null,
      confidenceScore: 0.85,
    });
  }

  if (summary.funds?.length) {
    try {
      const comparison = await comparePensionProducts(
        summary.funds.map(f => ({
          companyName: f.provider,
          productName: f.fundName,
          productType: f.fundType,
          totalSavings: f.currentBalance,
          depositFee: (f.managementFeeDeposit ?? 0) * (f.managementFeeDeposit < 0.05 ? 100 : 1),
          assetFee: (f.managementFeeAccumulation ?? 0) * (f.managementFeeAccumulation < 0.05 ? 100 : 1),
          status: 'פעיל',
        })),
      );
      for (const insight of comparison.pensionInsights || []) {
        if (insight.isPayingTooMuch) {
          recommendations.push({
            type: 'pension_fee_above_market',
            title: 'דמי ניהול פנסיה מעל השוק',
            reason: insight.recommendations?.feeInsight || `דמ"נ גבוהים ב-${insight.fundName}`,
            urgency: 'medium',
            financialImpact: insight.projected30YearLoss
              ? `הפסד צפוי ~₪${Math.round(insight.projected30YearLoss).toLocaleString('he-IL')}`
              : null,
            confidenceScore: 0.8,
          });
        }
      }
    } catch {
      // pensianet empty — skip
    }
  }

  if (payslip.studyFundEmployee != null && payslip.studyFundEmployee > 0) {
    const gemelProducts = (summary.funds || [])
      .filter(f => /השתלמות|study/i.test(`${f.fundType} ${f.fundName}`))
      .map(f => ({
        companyName: f.provider,
        productName: f.fundName,
        productType: f.fundType,
        totalSavings: f.currentBalance,
        depositFee: (f.managementFeeDeposit ?? 0) * 100,
        assetFee: (f.managementFeeAccumulation ?? 0) * 100,
        status: 'פעיל',
      }));

    if (gemelProducts.length) {
      const gemelAdvice = await buildGemelMarketAdvice(gemelProducts, {
        currentAge: summary.currentAge,
        personal: profile?.personal,
      });
      for (const f of gemelAdvice.funds || []) {
        if (f.verdict === 'NEGOTIATE' || f.verdict === 'SWITCH') {
          recommendations.push({
            type: 'study_fund_market',
            title: 'קרן השתלמות — ייעול מול גמל-נט',
            reason: f.summaryHe,
            urgency: f.verdict === 'SWITCH' ? 'high' : 'medium',
            financialImpact: f.annualSavingsEstimate
              ? `~₪${f.annualSavingsEstimate.toLocaleString('he-IL')}/שנה`
              : null,
            confidenceScore: 0.75,
          });
        }
        if (f.riskNote) {
          recommendations.push({
            type: 'study_fund_risk_mismatch',
            title: 'התאמת מסלול השתלמות',
            reason: f.riskNote,
            urgency: 'medium',
            financialImpact: null,
            confidenceScore: 0.7,
          });
        }
      }
    } else if (payslip.studyFundEmployee > 0) {
      recommendations.push({
        type: 'study_fund_deducted_no_fund_data',
        title: 'ניכוי קרן השתלמות בתלוש',
        reason: `ניכוי של ₪${Math.round(payslip.studyFundEmployee).toLocaleString('he-IL')} — ייבא דוח הר הכסף להשוואת דמ"נ מול גמל-נט`,
        urgency: 'low',
        financialImpact: null,
        confidenceScore: 0.6,
      });
    }
  }

  return recommendations;
}

module.exports = { buildPayslipGovBenchmarkRecommendations, getLatestPayslipContribution };
