/**
 * Pension Risk Advisor
 *
 * Uses profile data (age, risk tolerance, planned retirement age)
 * + pension fund data to produce risk-level recommendations,
 * fee analysis, and consolidation advice.
 *
 * Returns: { insights: Insight[], narrative: string, meta: object }
 */

const { buildPensionAnalysis } = require('./pensionAnalysisService');
const { generateDomainNarrative } = require('./domainNarrativeService');
const { buildDomainInsights } = require('./domainInsightService');
const {
  recommendedRiskLevel,
  resolveRetirementAge,
} = require('../utils/pensionShared');

const RETURNS = { high: 7.5, medium: 5.5, low: 3.5 };

function projectBalance(currentBalance, monthlyContrib, yearsLeft, annualReturn) {
  const r = annualReturn / 100 / 12;
  const n = yearsLeft * 12;
  const growth = (1 + r) ** n;
  const fv = currentBalance * growth + monthlyContrib * ((growth - 1) / r);
  return Math.round(fv);
}

/**
 * Unique insights not covered by benchmark-based recommendations.
 */
function buildEmployerContributionInsights(funds) {
  const activeFunds = (funds || []).filter(f => f.status !== 'closed');
  const lowEmployerFunds = activeFunds.filter(f => {
    if (!f.monthlyEmployerDeposit || !f.monthlyEmployeeDeposit) return false;
    const total = f.monthlyEmployerDeposit + f.monthlyEmployeeDeposit;
    const ratio = f.monthlyEmployerDeposit / total;
    return ratio < 0.45 && ratio > 0;
  });

  if (lowEmployerFunds.length === 0) return [];

  return [{
    id: 'employer_contribution_low',
    severity: 'warning',
    category: 'pension',
    title: 'הפרשת מעסיק לפנסיה נמוכה',
    description: 'הפרשת המעסיק נראית נמוכה מהמינימום החוקי (6.5% + 8.33% פיצויים).',
    recommendation: 'בדוק את חוזה ההעסקה ואת תלוש השכר מול הפקדות בפועל.',
    financialImpact: null,
    financialImpactLabel: null,
  }];
}

async function generatePensionNarrative(profile, funds, insights) {
  const activeFunds = (funds || []).filter(f => f.status !== 'closed');
  const totalBalance = activeFunds.reduce((s, f) => s + (f.currentBalance || 0), 0);
  const { age } = profile?.personal || {};
  const plannedRetirementAge = resolveRetirementAge(profile);
  const yearsLeft = age ? Math.max(0, plannedRetirementAge - age) : null;

  const contextLines = [
    '=== פרופיל פנסיוני ===',
    age ? `גיל: ${age}` : '',
    yearsLeft != null ? `שנים עד פרישה: ${yearsLeft}` : '',
    plannedRetirementAge ? `גיל פרישה מתוכנן: ${plannedRetirementAge}` : '',
    totalBalance ? `סה"כ צבירה: ₪${totalBalance.toLocaleString('he-IL')}` : '',
    '',
    `=== קרנות פעילות (${activeFunds.length}) ===`,
    ...activeFunds.map(f =>
      `• ${f.fundName || f.fundType} — צבירה: ₪${(f.currentBalance || 0).toLocaleString('he-IL')} — דמי ניהול: ${f.managementFeeAccumulation || '?'}%`
    ),
    '',
    '=== תובנות ===',
    ...insights.map(i => `• ${i.title}: ${i.recommendation}`),
  ].filter(Boolean);

  const systemPrompt = `אתה יועץ פנסיוני ישראלי מקצועי של FinGuide.
כתוב ניתוח פנסיוני אישי בעברית — 2-3 פסקאות.
דבר בגוף שני ישיר. ציין ערכים כספיים ספציפיים.
הדגש את המלצת מסלול הסיכון ואת ניתוח דמי הניהול.
⚠️ חובה לסיים ב: "לפני ביצוע שינויים בקרן הפנסיה — יש להתייעץ עם יועץ פנסיוני מורשה."`;

  return generateDomainNarrative({
    systemPrompt,
    contextLines,
    insights,
    userPromptSuffix: 'כתוב ניתוח פנסיוני אישי תמציתי.',
  });
}

async function getPensionInsights(userId) {
  return buildDomainInsights({
    userId,
    category: 'pension',
    buildAnalysisFn: buildPensionAnalysis,
    getExtraInsights: analysis =>
      buildEmployerContributionInsights(analysis.summary?.funds || []),
    generateNarrative: async (analysis, insights) => {
      const funds = analysis.summary?.funds || [];
      return generatePensionNarrative(analysis.profile, funds, insights);
    },
    buildMeta: analysis => {
      const { summary, benchmark, healthCheck, profile } = analysis;
      const funds = summary.funds || [];
      const activeFunds = funds.filter(f => f.status !== 'closed');
      const totalBalance = activeFunds.reduce((s, f) => s + (f.currentBalance || 0), 0);
      const { age } = profile?.personal || {};
      const plannedRetirementAge = resolveRetirementAge(profile);
      const yearsToRetirement = age ? Math.max(0, plannedRetirementAge - age) : null;

      let projectedBalance = null;
      if (totalBalance && yearsToRetirement && activeFunds.length) {
        const monthlyContrib = activeFunds.reduce((s, f) =>
          s + (f.monthlyEmployeeDeposit || 0) + (f.monthlyEmployerDeposit || 0), 0);
        const riskLevel = recommendedRiskLevel(age, yearsToRetirement);
        projectedBalance = projectBalance(totalBalance, monthlyContrib, yearsToRetirement, RETURNS[riskLevel]);
      }

      return {
        fundCount: funds.length,
        activeFundCount: activeFunds.length,
        totalBalance,
        projectedBalance,
        yearsToRetirement,
        recommendedRiskLevel: age ? recommendedRiskLevel(age, yearsToRetirement) : null,
        healthScore: healthCheck?.score ?? null,
        totalPotentialSavings: benchmark?.summary?.totalPotentialSavings ?? 0,
        avgRankPercentile: benchmark?.summary?.avgRankPercentile ?? null,
      };
    },
  });
}

module.exports = { getPensionInsights, buildEmployerContributionInsights };
