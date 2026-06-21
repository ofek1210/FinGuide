/**
 * Pension Risk Advisor
 *
 * Uses profile data (age, risk tolerance, planned retirement age)
 * + pension fund data to produce risk-level recommendations,
 * fee analysis, and consolidation advice.
 *
 * Returns: { insights: Insight[], narrative: string, meta: object }
 */

const PensionFund = require('../models/PensionFund');
const UserProfile = require('../models/UserProfile');
const { analyzeWithAI } = require('./aiProviderService');

const LEGAL_RETIREMENT_AGE = 67;
const MARKET_AVG_MGMT_FEE_ACCUMULATION = 0.35;
const RETURNS = { high: 7.5, medium: 5.5, low: 3.5 };

function recommendedRiskLevel(age, yearsToRetirement) {
  if (age < 35 || yearsToRetirement > 25) return 'high';
  if (age < 50 || yearsToRetirement > 15) return 'medium';
  return 'low';
}

function riskLevelLabel(level) {
  const map = { high: 'מניות (גבוה)', medium: 'כללי (בינוני)', low: 'מדדים/סולידי (נמוך)' };
  return map[level] || level;
}

function projectBalance(currentBalance, monthlyContrib, yearsLeft, annualReturn) {
  const r = annualReturn / 100 / 12;
  const n = yearsLeft * 12;
  const growth = (1 + r) ** n;
  const fv = currentBalance * growth + monthlyContrib * ((growth - 1) / r);
  return Math.round(fv);
}

function buildInsights(profile, funds) {
  const insights = [];
  const { personal = {}, financial = {}, retirement = {} } = profile || {};

  const { age } = personal;
  const plannedRetirementAge = retirement.plannedRetirementAge || LEGAL_RETIREMENT_AGE;
  const yearsToRetirement = age ? Math.max(0, plannedRetirementAge - age) : null;

  const activeFunds = funds.filter(f => f.status !== 'closed');
  const totalBalance = activeFunds.reduce((s, f) => s + (f.currentBalance || 0), 0);
  const totalMonthlyContrib = activeFunds.reduce((s, f) =>
    s + (f.monthlyEmployeeDeposit || 0) + (f.monthlyEmployerDeposit || 0), 0);

  // ── 1. Risk level mismatch ──────────────────────────────────────────
  if (age && yearsToRetirement != null) {
    const recommended = recommendedRiskLevel(age, yearsToRetirement);
    activeFunds.forEach(fund => {
      const current = (fund.riskLevel || 'unknown').toLowerCase();
      let currentNorm;
      if (current.includes('low') || current.includes('נמוך') || current.includes('סולידי')) {
        currentNorm = 'low';
      } else if (current.includes('high') || current.includes('גבוה') || current.includes('מניות')) {
        currentNorm = 'high';
      } else {
        currentNorm = 'medium';
      }

      if (recommended !== currentNorm && currentNorm !== 'unknown') {
        const currentReturn = RETURNS[currentNorm] || 5;
        const recommendedReturn = RETURNS[recommended];
        const impact = (yearsToRetirement && totalBalance && totalMonthlyContrib)
          ? projectBalance(totalBalance, totalMonthlyContrib, yearsToRetirement, recommendedReturn) -
            projectBalance(totalBalance, totalMonthlyContrib, yearsToRetirement, currentReturn)
          : null;

        insights.push({
          id: `risk_mismatch_${fund._id}`,
          severity: (recommended === 'high' && currentNorm === 'low') ? 'warning' : 'info',
          category: 'pension',
          title: `מסלול סיכון לא מתאים לגיל — ${fund.fundName || 'קרן פנסיה'}`,
          description: `גיל ${age}, ${yearsToRetirement} שנים עד פרישה. מסלול נוכחי: ${riskLevelLabel(currentNorm)}. מסלול מומלץ לגילך: ${riskLevelLabel(recommended)}.`,
          recommendation: impact
            ? `מעבר למסלול ${riskLevelLabel(recommended)} צפוי להוסיף ~₪${impact.toLocaleString('he-IL')} לצבירה בפרישה (+${recommendedReturn - currentReturn}% תשואה שנתית).`
            : `שקול לעדכן את מסלול הסיכון ל-${riskLevelLabel(recommended)} דרך האתר/אפליקציית הקרן.`,
          financialImpact: impact,
          financialImpactLabel: impact ? `+₪${impact.toLocaleString('he-IL')} בפרישה` : null,
        });
      }
    });
  }

  // ── 2. High management fee ──────────────────────────────────────────
  activeFunds.forEach(fund => {
    const fee = fund.managementFeeAccumulation;
    if (fee != null && fee > MARKET_AVG_MGMT_FEE_ACCUMULATION) {
      const excessPct = fee - MARKET_AVG_MGMT_FEE_ACCUMULATION;
      const annualExcess = fund.currentBalance ? Math.round((excessPct / 100) * fund.currentBalance) : null;
      const lifetimeSavings = (annualExcess && yearsToRetirement)
        ? Math.round(annualExcess * yearsToRetirement * 1.5)
        : null;

      insights.push({
        id: `mgmt_fee_high_${fund._id}`,
        severity: fee > 0.7 ? 'warning' : 'info',
        category: 'pension',
        title: `דמי ניהול גבוהים — ${fund.fundName || 'קרן'}`,
        description: `דמי ניהול: ${fee}% מהצבירה. ממוצע שוק: ${MARKET_AVG_MGMT_FEE_ACCUMULATION}%.${annualExcess ? ` עודף שנתי: ~₪${annualExcess.toLocaleString('he-IL')}.` : ''}`,
        recommendation: `פנה לקרן לנהל משא-ומתן. זכאי לדמי ניהול נמוכים יותר.${lifetimeSavings ? ` חיסכון צפוי עד פרישה: ~₪${lifetimeSavings.toLocaleString('he-IL')}.` : ''}`,
        financialImpact: lifetimeSavings,
        financialImpactLabel: lifetimeSavings ? `₪${lifetimeSavings.toLocaleString('he-IL')} חיסכון עד פרישה` : null,
      });
    }
  });

  // ── 3. Multiple funds — consolidation ──────────────────────────────
  if (activeFunds.length > 2) {
    const estimatedDuplicateFees = 600 * (activeFunds.length - 1);
    insights.push({
      id: 'multiple_funds',
      severity: 'info',
      category: 'pension',
      title: `ריבוי קרנות — ${activeFunds.length} קרנות פעילות`,
      description: `ניהול ${activeFunds.length} קרנות במקביל פירושו ריבוי דמי ניהול ועמלות. מומלץ לרכז.`,
      recommendation: `רכז ל-1-2 קרנות בעלות ביצועים טובים ודמי ניהול נמוכים. חיסכון משוער: ~₪${estimatedDuplicateFees.toLocaleString('he-IL')}/שנה.`,
      financialImpact: estimatedDuplicateFees,
      financialImpactLabel: `₪${estimatedDuplicateFees.toLocaleString('he-IL')}/שנה חיסכון`,
    });
  }

  // ── 4. Employer contribution too low ───────────────────────────────
  const lowEmployerFunds = activeFunds.filter(f => {
    if (!f.monthlyEmployerDeposit || !f.monthlyEmployeeDeposit) return false;
    const total = f.monthlyEmployerDeposit + f.monthlyEmployeeDeposit;
    const ratio = f.monthlyEmployerDeposit / total;
    return ratio < 0.45 && ratio > 0;
  });
  if (lowEmployerFunds.length > 0) {
    insights.push({
      id: 'employer_contribution_low',
      severity: 'warning',
      category: 'pension',
      title: 'הפרשת מעסיק לפנסיה נמוכה',
      description: 'הפרשת המעסיק נראית נמוכה מהמינימום החוקי (6.5% + 8.33% פיצויים).',
      recommendation: 'בדוק את חוזה ההעסקה ואת תלוש השכר מול הפקדות בפועל.',
      financialImpact: null,
      financialImpactLabel: null,
    });
  }

  // ── 5. No study fund detected ───────────────────────────────────────
  if (retirement.hasStudyFund === false || (retirement.hasStudyFund == null && activeFunds.length > 0)) {
    insights.push({
      id: 'no_study_fund',
      severity: 'info',
      category: 'pension',
      title: 'לא זוהתה קרן השתלמות',
      description: 'קרן השתלמות היא כלי החיסכון הטוב ביותר לטווח בינוני — עד ₪20,520/שנה פטורים ממס.',
      recommendation: 'בדוק מול המעסיק אם קיימת קרן השתלמות ואת תנאי ההפרשה.',
      financialImpact: null,
      financialImpactLabel: 'עד ₪20,520/שנה פטור ממס',
    });
  }

  // financial.riskTolerance reserved for future use — suppress unused-vars
  // eslint-disable-next-line no-unused-vars
  const { riskTolerance: _rt } = financial;

  return insights;
}

async function generatePensionNarrative(profile, funds, insights) {
  const { personal = {}, retirement = {} } = profile || {};
  const activeFunds = funds.filter(f => f.status !== 'closed');
  const totalBalance = activeFunds.reduce((s, f) => s + (f.currentBalance || 0), 0);
  const { age } = personal;
  const plannedRetirementAge = retirement.plannedRetirementAge || LEGAL_RETIREMENT_AGE;
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

  const userPrompt = `${contextLines.join('\n')}\n\nכתוב ניתוח פנסיוני אישי תמציתי.`;
  const result = await analyzeWithAI(systemPrompt, userPrompt, { maxTokens: 600, temperature: 0.35 });
  return result || insights.map(i => `• ${i.title}: ${i.recommendation}`).join('\n');
}

async function getPensionInsights(userId) {
  const [funds, profile] = await Promise.all([
    PensionFund.find({ user: userId }).lean(),
    UserProfile.findOne({ user: userId }).lean(),
  ]);

  const activeFunds = funds.filter(f => f.status !== 'closed');
  const totalBalance = activeFunds.reduce((s, f) => s + (f.currentBalance || 0), 0);

  const insights = buildInsights(profile, funds);
  const narrative = await generatePensionNarrative(profile, funds, insights);

  const { age } = profile?.personal || {};
  const plannedRetirementAge = profile?.retirement?.plannedRetirementAge || LEGAL_RETIREMENT_AGE;
  const yearsToRetirement = age ? Math.max(0, plannedRetirementAge - age) : null;

  let projectedBalance = null;
  if (totalBalance && yearsToRetirement && activeFunds.length) {
    const monthlyContrib = activeFunds.reduce((s, f) =>
      s + (f.monthlyEmployeeDeposit || 0) + (f.monthlyEmployerDeposit || 0), 0);
    const riskLevel = recommendedRiskLevel(age, yearsToRetirement);
    projectedBalance = projectBalance(totalBalance, monthlyContrib, yearsToRetirement, RETURNS[riskLevel]);
  }

  return {
    insights,
    narrative,
    meta: {
      fundCount: funds.length,
      activeFundCount: activeFunds.length,
      totalBalance,
      projectedBalance,
      yearsToRetirement,
      recommendedRiskLevel: age ? recommendedRiskLevel(age, yearsToRetirement) : null,
    },
  };
}

module.exports = { getPensionInsights };
