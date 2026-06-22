/**
 * Insurance Profile Analyzer
 *
 * Analyzes existing insurance policies against the user's personal profile
 * to surface redundancies, gaps, and cost-saving opportunities.
 *
 * Returns: { insights: Insight[], narrative: string, meta: object }
 */

const { buildInsuranceAnalysis } = require('./insuranceAnalysisService');
const { generateDomainNarrative } = require('./domainNarrativeService');
const { buildDomainInsights } = require('./domainInsightService');
const { recommendationsToInsights, healthCategoriesToInsights } = require('../utils/insightMapper');

const SMOKING_PREMIUM_UPLIFT = 0.30;

function getAnnual(pol) {
  return pol.annualPremium ?? (pol.monthlyPremium ? pol.monthlyPremium * 12 : 0);
}

function getMonthly(pol) {
  return pol.monthlyPremium ?? (pol.annualPremium ? pol.annualPremium / 12 : 0);
}

function calcSmokerSavingsPerYear(policies) {
  const smokingRelated = policies.filter(pol =>
    ['life', 'health', 'disability', 'critical_illness'].includes(pol.type)
  );
  const annualPremiums = smokingRelated.reduce((sum, pol) => sum + getAnnual(pol), 0);
  return Math.round(annualPremiums * SMOKING_PREMIUM_UPLIFT);
}

function buildInsights(profile, policies) {
  const insights = [];
  const p = profile || {};
  const { personal = {}, assets = {}, financial = {} } = p;

  const { age, isSmoker, childrenCount: rawChildrenCount = 0 } = personal;
  const childrenCount = rawChildrenCount;
  const { ownsApartment, hasMortgage, ownsCar } = assets;

  const activeByType = {};
  policies.filter(pol => pol.status === 'active').forEach(pol => {
    if (!activeByType[pol.type]) activeByType[pol.type] = [];
    activeByType[pol.type].push(pol);
  });

  const hasLifeInsurance = !!(activeByType.life?.length);
  const hasHealthInsurance = !!(activeByType.health?.length);
  const hasDisability = !!(activeByType.disability?.length);
  const hasCarInsurance = !!(activeByType.car?.length);

  const totalMonthlyPremium = policies.reduce((sum, pol) => {
    if (pol.status !== 'active') return sum;
    return sum + getMonthly(pol);
  }, 0);

  if (hasLifeInsurance && childrenCount === 0 && !hasMortgage) {
    const lifeAnnual = (activeByType.life || []).reduce((sum, pol) => sum + getAnnual(pol), 0);
    const lifeMonthly = Math.round(lifeAnnual / 12);
    insights.push({
      id: 'life_insurance_unnecessary',
      severity: 'warning',
      category: 'insurance',
      title: 'ביטוח חיים — ייתכן שמיותר',
      description: 'ביטוח חיים מיועד להגנת תלויים (ילדים, בן/בת זוג) או לכיסוי משכנתא. אין לך ילדים ואין משכנתא — לכן הכיסוי לא מגן על אף אחד.',
      recommendation: `שקול לבטל את ביטוח החיים ולחסוך ~₪${lifeMonthly.toLocaleString('he-IL')}/חודש. לפני ביטול — התייעץ עם סוכן מורשה.`,
      financialImpact: lifeMonthly * 12,
      financialImpactLabel: `חיסכון ~₪${(lifeMonthly * 12).toLocaleString('he-IL')}/שנה`,
    });
  }

  if (isSmoker === true && policies.length > 0) {
    const yearSavings = calcSmokerSavingsPerYear(policies);
    if (yearSavings > 0) {
      insights.push({
        id: 'smoker_premium_uplift',
        severity: 'info',
        category: 'insurance',
        title: 'חיסכון בהפסקת עישון',
        description: 'כמעשן/ת אתה משלם/ת פרמיה גבוהה יותר על ביטוח חיים, בריאות ואכ"ע.',
        recommendation: `לאחר הפסקת עישון ו-12 חודשים ללא עישון, ניתן לדרוש הפחתת פרמיה — חיסכון צפוי: ~₪${yearSavings.toLocaleString('he-IL')}/שנה.`,
        financialImpact: yearSavings,
        financialImpactLabel: `₪${yearSavings.toLocaleString('he-IL')}/שנה בהפסקת עישון`,
      });
    }
  }

  if (ownsApartment === false && !activeByType.apartment?.length) {
    insights.push({
      id: 'renter_no_contents_insurance',
      severity: 'warning',
      category: 'insurance',
      title: 'שוכר/ת ללא ביטוח תכולה',
      description: 'כשוכר/ת, אין לך ביטוח דירה שמכסה את תכולתך האישית (רהיטים, אלקטרוניקה, ביגוד).',
      recommendation: 'ביטוח תכולה לשוכרים עולה ~₪30-60/חודש ומגן על רכושך מפני גניבה, שריפה ונזקי מים.',
      financialImpact: null,
      financialImpactLabel: 'כיסוי מומלץ ₪30-60/חודש',
    });
  }

  if (!hasDisability && age != null && age < 50) {
    insights.push({
      id: 'disability_insurance_missing',
      severity: 'error',
      category: 'insurance',
      title: 'אין ביטוח אובדן כושר עבודה',
      description: 'ביטוח אכ"ע הוא הביטוח הקריטי ביותר לשכירים — מגן על הכנסתך אם תפסיק לעבוד בגלל מחלה/תאונה.',
      recommendation: 'בדוק אם הפנסיה שלך כוללת ביטוח נכות. אם לא — רכוש ביטוח אכ"ע עצמאי. עלות טיפוסית: ₪100-200/חודש.',
      financialImpact: null,
      financialImpactLabel: 'חיוני לאבטחת הכנסה',
    });
  }

  if (ownsCar && hasCarInsurance) {
    const carPolicies = activeByType.car || [];
    const comprehensivePolicies = carPolicies.filter(pol => {
      const notes = (pol.notes || '').toLowerCase();
      return notes.includes('מקיף') || notes.includes('comprehensive');
    });

    if (comprehensivePolicies.length > 0) {
      insights.push({
        id: 'old_car_comprehensive',
        severity: 'info',
        category: 'insurance',
        title: 'ביטוח מקיף — בדוק כדאיות',
        description: 'אם הרכב ישן (+10 שנים) ועלות הביטוח המקיף עולה על 15% מערך הרכב — ייתכן שלא כדאי.',
        recommendation: 'השווה את פרמיית ביטוח מקיף לשווי הרכב הנוכחי. ייתכן שמעבר לצד-ג+ בלבד יחסוך מאות שקלים.',
        financialImpact: null,
        financialImpactLabel: 'פוטנציאל חיסכון',
      });
    }
  }

  if (hasHealthInsurance) {
    const healthPolicies = activeByType.health || [];
    if (healthPolicies.length >= 2) {
      const annualDouble = healthPolicies.slice(1).reduce((sum, pol) => sum + getAnnual(pol), 0);
      insights.push({
        id: 'health_insurance_duplicate',
        severity: 'warning',
        category: 'insurance',
        title: 'כפילות בביטוח בריאות',
        description: `נמצאו ${healthPolicies.length} פוליסות ביטוח בריאות פעילות. קופת החולים כוללת ביטוח מושלם — בדוק חפיפה עם הפוליסות הפרטיות.`,
        recommendation: `ייתכן חיסכון של ~₪${Math.round(annualDouble / 12).toLocaleString('he-IL')}/חודש בביטול כיסויים כפולים.`,
        financialImpact: Math.round(annualDouble),
        financialImpactLabel: `₪${Math.round(annualDouble).toLocaleString('he-IL')}/שנה בביטול כפילויות`,
      });
    }
  }

  const salaryRangeMap = { under_5k: 5000, '5k_10k': 7500, '10k_15k': 12500, '15k_20k': 17500, '20k_30k': 25000, '30k_50k': 40000, above_50k: 60000 };
  const estimatedSalary = salaryRangeMap[financial.salaryRange] || null;
  if (estimatedSalary && totalMonthlyPremium > estimatedSalary * 0.08) {
    insights.push({
      id: 'premium_too_high',
      severity: 'warning',
      category: 'insurance',
      title: 'סל הביטוח יקר יחסית לשכר',
      description: `סך הפרמיה החודשית שלך (₪${Math.round(totalMonthlyPremium).toLocaleString('he-IL')}) עולה על 8% מהשכר המשוער — נורמה מומלצת היא 5–7%.`,
      recommendation: 'מומלץ לבצע סקר ביטוח מקיף ולבדוק את כל הפוליסות מול סוכן עצמאי.',
      financialImpact: null,
      financialImpactLabel: null,
    });
  }

  return insights;
}

async function generateInsuranceNarrative(profile, policies, insights) {
  const { personal = {}, assets = {} } = profile || {};

  const contextLines = [
    '=== פרופיל המשתמש ===',
    personal.age ? `גיל: ${personal.age}` : '',
    personal.maritalStatus ? `מצב משפחתי: ${personal.maritalStatus}` : '',
    personal.childrenCount != null ? `ילדים: ${personal.childrenCount}` : '',
    personal.isSmoker != null ? `מעשן/ת: ${personal.isSmoker ? 'כן' : 'לא'}` : '',
    assets.ownsApartment != null ? `דירה: ${assets.ownsApartment ? 'בבעלות' : 'שוכר/ת'}` : '',
    assets.hasMortgage != null ? `משכנתא: ${assets.hasMortgage ? 'כן' : 'לא'}` : '',
    '',
    `=== פוליסות קיימות (${policies.length}) ===`,
    ...policies.filter(pol => pol.status === 'active').map(pol => {
      const monthly = pol.monthlyPremium ?? (pol.annualPremium ? Math.round(pol.annualPremium / 12) : null);
      return `• ${pol.type} — ${pol.provider || 'לא ידוע'} — ₪${monthly ? monthly.toLocaleString('he-IL') : '?'}/חודש`;
    }),
    '',
    '=== תובנות שהתגלו ===',
    ...insights.map(i => `• ${i.title}: ${i.recommendation}`),
  ].filter(l => l !== '');

  const systemPrompt = `אתה יועץ ביטוח ישראלי מקצועי של FinGuide.
כתוב ניתוח ביטוח אישי בעברית — 2-3 פסקאות.
דבר בגוף שני ישיר. ציין מספרים ספציפיים.
הדגש את 2-3 הנקודות הכי חשובות בלבד.
⚠️ חובה לסיים ב: "המידע הוא לצרכי מידע בלבד. לפני שינוי פוליסות — יש להתייעץ עם סוכן ביטוח מורשה."`;

  return generateDomainNarrative({
    systemPrompt,
    contextLines,
    insights,
    userPromptSuffix: 'כתוב ניתוח ביטוח אישי תמציתי.',
  });
}

function buildProfileOnlyInsights(profile, policies, seenTitles) {
  return buildInsights(profile, policies).filter(i => !seenTitles.has(i.title));
}

async function getInsuranceInsights(userId) {
  return buildDomainInsights({
    userId,
    category: 'insurance',
    buildAnalysisFn: buildInsuranceAnalysis,
    getExtraInsights: analysis => {
      const profile = {
        personal: analysis.personal || {},
        assets: analysis.assets || {},
        financial: analysis.profile?.financial || {},
      };
      const policies = analysis.policies || [];
      const recTitles = new Set(
        recommendationsToInsights(analysis.recommendations, 'insurance').map(i => i.title),
      );
      const healthTitles = new Set(
        healthCategoriesToInsights(analysis.healthCheck?.categories, 'insurance').map(i => i.title),
      );
      const seenTitles = new Set([...recTitles, ...healthTitles]);
      return buildProfileOnlyInsights(profile, policies, seenTitles);
    },
    generateNarrative: async (analysis, insights) => {
      const profile = {
        personal: analysis.personal || {},
        assets: analysis.assets || {},
      };
      return generateInsuranceNarrative(profile, analysis.policies || [], insights);
    },
    buildMeta: analysis => {
      const policies = analysis.policies || [];
      const totalMonthlyPremium = policies.reduce((sum, pol) => {
        if (pol.status !== 'active') return sum;
        return sum + getMonthly(pol);
      }, 0);

      return {
        policyCount: policies.length,
        activePolicies: policies.filter(pol => pol.status === 'active').length,
        totalMonthlyPremium: Math.round(totalMonthlyPremium),
        totalAnnualPremium: Math.round(totalMonthlyPremium * 12),
        healthScore: analysis.healthCheck?.score ?? null,
        duplicateCount: analysis.analysis?.duplicateCount ?? 0,
        annualSavings: analysis.analysis?.savings?.annualSavings ?? 0,
        totalMonthlyWaste: analysis.analysis?.totalMonthlyWaste ?? 0,
      };
    },
  });
}

module.exports = { getInsuranceInsights };
