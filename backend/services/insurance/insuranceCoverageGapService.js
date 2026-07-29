'use strict';

const { hasDisabilityCoverage } = require('../pensionCoverageAnalysisService');

const COVERAGE_WHY_HE = {
  life: 'ביטוח חיים נועד להגן על תלויים כלכלית (בן/בת זוג, ילדים) ועל התחייבויות כמו משכנתא אם יקרה משהו למפרנס.',
  apartment: 'ביטוח דירה מגן על המבנה והתכולה מפני נזקי אש, מים, גניבה ואירועים דומים — רלוונטי לבעלי דירה.',
  car: 'ביטוח רכב (לפחות חובה) נדרש בחוק לרכב בבעלות; מקיף מגן על נזק לרכב עצמו.',
  health_supplement: 'ביטוח בריאות משלים מכסה טיפולים וניתוחים מעבר לסל הציבורי — שימושי כשאין כיסוי פרטי.',
  disability: 'אובדן כושר עבודה מגן על ההכנסה במקרה של פגיעה או מחלה ממושכת — לעיתים קיים גם בפנסיה.',
  travel: 'ביטוח נסיעות לחו״ל רלוונטי בעיקר למי שנוסע לעיתים קרובות — לא חובה קבועה בתיק.',
};

const DISABILITY_GAP_MESSAGE =
  'לא זוהה כיסוי אובדן כושר עבודה בקובץ הביטוח שהועלה. כדאי לבדוק אם הכיסוי קיים בקרן הפנסיה, בביטוח מנהלים או דרך המעסיק.';

function hasDependentsSignal(personal, needsLifeInsurance) {
  if (needsLifeInsurance === true) return true;
  if (personal?.hasDependents === true) return true;
  if ((personal?.childrenCount || 0) > 0) return true;
  if (['married', 'partnered'].includes(personal?.maritalStatus)) return true;
  return false;
}

function lifeInsuranceNotNeeded(personal, needsLifeInsurance, assets) {
  if (needsLifeInsurance === false) return true;
  if (needsLifeInsurance === true) return false;
  const single = personal?.maritalStatus === 'single' || personal?.maritalStatus === 'divorced';
  const noKids = (personal?.childrenCount || 0) === 0;
  const noDependents = personal?.hasDependents !== true;
  const noMortgage = assets?.hasMortgage !== true;
  return Boolean(single && noKids && noDependents && noMortgage);
}

/**
 * Detect coverage gaps with profile-aware need assessment.
 */
function analyzeCoverageGaps(profileDTO, aggregatedPolicies, options = {}) {
  const coveredTypes = new Set((aggregatedPolicies || []).map(p => p.type));
  const missing = [];
  const flags = [];
  const gapFindings = [];
  const needAssessments = [];

  const ins = profileDTO?.insurance || profileDTO?.profile || {};
  const assets = profileDTO?.assets || {};
  const personal = profileDTO?.personal || {};
  const pensionFunds = options.pensionFunds || [];
  const needsLifeInsurance = profileDTO?.needsLifeInsurance;

  // ── Life ──────────────────────────────────────────────────────────────
  const lifeCovered = coveredTypes.has('life') || ins.hasLifeInsurance === true;
  if (!lifeCovered) {
    if (lifeInsuranceNotNeeded(personal, needsLifeInsurance, assets)) {
      needAssessments.push({
        type: 'life',
        needed: false,
        status: 'not_recommended',
        titleHe: 'ביטוח חיים — לא נראה נחוץ לפי הפרופיל',
        messageHe: 'לפי הפרופיל (ללא תלויים / ילדים / משכנתא, או שציינת שאינך זקוק/ה) — אין המלצה אוטומטית לרכוש ביטוח חיים.',
        whyItMatters: COVERAGE_WHY_HE.life,
      });
    } else if (hasDependentsSignal(personal, needsLifeInsurance) || needsLifeInsurance === true
      || (personal.maritalStatus === 'married' && ins.hasLifeInsurance === false)
      || assets.hasMortgage === true) {
      missing.push('life');
      gapFindings.push({
        type: 'life',
        status: 'missing_needed',
        messageHe: 'חסר ביטוח חיים — הפרופיל מצביע על תלויים או התחייבויות שמצדיקים כיסוי.',
        whyItMatters: COVERAGE_WHY_HE.life,
        missingInputs: [],
        confidence: needsLifeInsurance === true ? 'high' : 'medium',
      });
    } else {
      needAssessments.push({
        type: 'life',
        needed: null,
        status: 'insufficient_profile',
        titleHe: 'ביטוח חיים — לא ניתן לקבוע',
        messageHe: 'חסר מידע בפרופיל (מצב משפחתי / תלויים / צורך מוצהר) כדי לקבוע אם ביטוח חיים נחוץ.',
        whyItMatters: COVERAGE_WHY_HE.life,
      });
    }
  } else if (lifeInsuranceNotNeeded(personal, needsLifeInsurance, assets)) {
    needAssessments.push({
      type: 'life',
      needed: false,
      status: 'possibly_unnecessary',
      titleHe: 'ביטוח חיים — ייתכן שאינו נחוץ כרגע',
      messageHe: 'קיים כיסוי חיים בתיק, אך לפי הפרופיל (ללא תלויים / ילדים / משכנתא) אין אינדיקציה חזקה שהוא נדרש כרגע. מומלץ לאמת מול סוכן לפני שינוי.',
      whyItMatters: COVERAGE_WHY_HE.life,
    });
  } else {
    needAssessments.push({
      type: 'life',
      needed: true,
      status: 'covered',
      titleHe: 'ביטוח חיים — קיים בתיק',
      messageHe: 'זוהה כיסוי חיים בפוליסות או בפרופיל, והפרופיל תומך בצורך.',
      whyItMatters: COVERAGE_WHY_HE.life,
    });
  }

  // ── Disability ────────────────────────────────────────────────────────
  const hasHarDisability = coveredTypes.has('disability');
  const hasProfileDisability = ins.hasDisabilityInsurance === true;
  const hasPensionDisability = pensionFunds.some(f =>
    hasDisabilityCoverage(f.insuranceCoverages || []),
  );

  if (!hasHarDisability && !hasProfileDisability && !hasPensionDisability) {
    gapFindings.push({
      type: 'disability',
      status: 'unverified_in_file',
      messageHe: DISABILITY_GAP_MESSAGE,
      whyItMatters: COVERAGE_WHY_HE.disability,
      missingInputs: ['pensionDisabilityCheck', 'employerArrangement'],
      confidence: 'low',
    });
    flags.push({
      code: 'disability_unverified',
      urgency: 'medium',
      label: DISABILITY_GAP_MESSAGE,
    });
    needAssessments.push({
      type: 'disability',
      needed: true,
      status: 'unverified',
      titleHe: 'אובדן כושר עבודה — לא זוהה בקובץ',
      messageHe: DISABILITY_GAP_MESSAGE,
      whyItMatters: COVERAGE_WHY_HE.disability,
    });
  } else {
    needAssessments.push({
      type: 'disability',
      needed: true,
      status: 'covered_or_elsewhere',
      titleHe: 'אובדן כושר עבודה — זוהה כיסוי או מקור אחר',
      messageHe: hasHarDisability
        ? 'קיים כיסוי אכ״ע בדוח הר הביטוח.'
        : hasPensionDisability
          ? 'זוהה כיסוי אכ״ע במסלקה הפנסיונית.'
          : 'דווח בפרופיל על כיסוי אכ״ע.',
      whyItMatters: COVERAGE_WHY_HE.disability,
    });
  }

  // ── Home ──────────────────────────────────────────────────────────────
  if (assets.ownsApartment === true && !ins.hasApartmentInsurance && !coveredTypes.has('apartment')) {
    missing.push('apartment');
    gapFindings.push({
      type: 'apartment',
      status: 'missing_needed',
      messageHe: 'בבעלותך דירה ללא ביטוח דירה מדווח — מומלץ לבדוק כיסוי מבנה (ולעיתים גם תכולה).',
      whyItMatters: COVERAGE_WHY_HE.apartment,
      confidence: 'high',
    });
  } else if (assets.ownsApartment === false) {
    needAssessments.push({
      type: 'apartment',
      needed: false,
      status: 'not_recommended',
      titleHe: 'ביטוח מבנה — לא רלוונטי לשוכר',
      messageHe: 'לפי הפרופיל אינך בעל/ת דירה — אין המלצה לביטוח מבנה. ביטוח תכולה לשוכרים עשוי להיות רלוונטי בנפרד.',
      whyItMatters: COVERAGE_WHY_HE.apartment,
    });
    if (!coveredTypes.has('apartment')) {
      needAssessments.push({
        type: 'contents',
        needed: null,
        status: 'optional_renter',
        titleHe: 'ביטוח תכולה — אופציונלי לשוכרים',
        messageHe: 'כשוכר/ת, ביטוח מבנה אינו נחוץ, אך ביטוח תכולה יכול להגן על רכוש אישי. אין חובה אוטומטית לפי הנתונים.',
        whyItMatters: 'ביטוח תכולה מכסה רכוש אישי (רהיטים, אלקטרוניקה) מפני גניבה, אש ונזקי מים — רלוונטי בעיקר לשוכרים.',
      });
    }
  } else if (coveredTypes.has('apartment') || ins.hasApartmentInsurance === true) {
    needAssessments.push({
      type: 'apartment',
      needed: true,
      status: 'covered',
      titleHe: 'ביטוח דירה — קיים',
      messageHe: 'זוהה כיסוי דירה בתיק או בפרופיל.',
      whyItMatters: COVERAGE_WHY_HE.apartment,
    });
  }

  // ── Vehicle ───────────────────────────────────────────────────────────
  if (assets.ownsCar === true && !ins.hasCarInsurance && !coveredTypes.has('car')) {
    missing.push('car');
    gapFindings.push({
      type: 'car',
      status: 'missing_needed',
      messageHe: 'בבעלותך רכב ללא ביטוח רכב מדווח — ביטוח חובה הוא חובה בחוק.',
      whyItMatters: COVERAGE_WHY_HE.car,
      confidence: 'high',
    });
  } else if (assets.ownsCar === false) {
    needAssessments.push({
      type: 'car',
      needed: false,
      status: 'not_recommended',
      titleHe: 'ביטוח רכב — לא רלוונטי',
      messageHe: 'לפי הפרופיל אין רכב בבעלות — אין המלצה אוטומטית לביטוח רכב.',
      whyItMatters: COVERAGE_WHY_HE.car,
    });
  } else if (coveredTypes.has('car') || ins.hasCarInsurance === true) {
    needAssessments.push({
      type: 'car',
      needed: true,
      status: 'covered',
      titleHe: 'ביטוח רכב — קיים',
      messageHe: 'זוהה כיסוי רכב בתיק או בפרופיל.',
      whyItMatters: COVERAGE_WHY_HE.car,
    });
  }

  // ── Health supplement ─────────────────────────────────────────────────
  if (!ins.hasHealthInsurance && !coveredTypes.has('health') && !coveredTypes.has('critical_illness')) {
    if (personal.age != null && personal.age > 30) {
      missing.push('health_supplement');
      gapFindings.push({
        type: 'health_supplement',
        status: 'missing_optional',
        messageHe: 'לא זוהה ביטוח בריאות משלים — בגילך כדאי לבדוק אם קיים כיסוי דרך מעסיק או קופה.',
        whyItMatters: COVERAGE_WHY_HE.health_supplement,
        confidence: 'medium',
      });
    } else {
      needAssessments.push({
        type: 'health_supplement',
        needed: null,
        status: 'optional',
        titleHe: 'ביטוח בריאות משלים — אופציונלי',
        messageHe: 'לא זוהה כיסוי משלים. אין חובה אוטומטית לפי הפרופיל הנוכחי.',
        whyItMatters: COVERAGE_WHY_HE.health_supplement,
      });
    }
  }

  // ── Travel — only when onboarding/goals indicate frequent travel ───────
  const frequentTravel = profileDTO?.frequentTravel === true
    || (Array.isArray(profileDTO?.goals) && profileDTO.goals.some(g => g?.type === 'travel'));
  const hasTravelPolicy = coveredTypes.has('travel');

  if (frequentTravel && !hasTravelPolicy) {
    needAssessments.push({
      type: 'travel',
      needed: true,
      status: 'recommended',
      titleHe: 'ביטוח נסיעות — מומלץ לפי הפרופיל',
      messageHe: 'הפרופיל מצביע על נסיעות / יעד נסיעות — כדאי לוודא כיסוי נסיעות לחו״ל לפני יציאה.',
      whyItMatters: COVERAGE_WHY_HE.travel,
    });
  } else if (frequentTravel && hasTravelPolicy) {
    needAssessments.push({
      type: 'travel',
      needed: true,
      status: 'covered',
      titleHe: 'ביטוח נסיעות — קיים',
      messageHe: 'זוהתה פוליסת נסיעות בתיק.',
      whyItMatters: COVERAGE_WHY_HE.travel,
    });
  } else {
    needAssessments.push({
      type: 'travel',
      needed: false,
      status: 'not_recommended',
      titleHe: 'ביטוח נסיעות — אין אינדיקציה לצורך קבוע',
      messageHe: 'אין בפרופיל אינדיקציה לנסיעות תכופות — אין המלצה אוטומטית לרכוש ביטוח נסיעות כחלק קבוע מהתיק.',
      whyItMatters: COVERAGE_WHY_HE.travel,
    });
  }

  const urgency = missing.includes('apartment') || missing.includes('car')
    || gapFindings.some(g => g.type === 'disability' || g.type === 'life')
    ? 'medium'
    : missing.length ? 'low' : 'low';

  return {
    missingTypes: missing,
    gapFindings,
    needAssessments,
    urgency,
    flags,
    disabilityCheckedSources: {
      harFile: hasHarDisability,
      profile: hasProfileDisability,
      pension: hasPensionDisability,
    },
  };
}

module.exports = {
  analyzeCoverageGaps,
  DISABILITY_GAP_MESSAGE,
  COVERAGE_WHY_HE,
  lifeInsuranceNotNeeded,
  hasDependentsSignal,
};
