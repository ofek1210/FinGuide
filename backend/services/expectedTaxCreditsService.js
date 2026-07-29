/**
 * Expected Israeli income-tax credit points from user profile.
 * Compares against payslip OCR credit points to surface savings opportunities.
 * Locality (סעיף 11) credits use percent-of-income up to an annual cap from the
 * Monthly Deductions Booklet — not credit points.
 */

const { DEFAULT_ANNUAL_CREDIT_POINT_VALUE } = require('./taxAdjustmentRulesService');
const {
  computeLocalityIncomeCredit,
  lookupQualifyingLocality,
} = require('./qualifyingLocalitiesTaxCredit');

const MONTHLY_CREDIT_POINT_VALUE = 242;

/** @deprecated Kept for callers/tests that still inspect the old map; prefer qualifyingLocalitiesTaxCredit. */
const DEVELOPMENT_ZONE_CITIES = new Map([
  ['דימונה', 'אזור פיתוח א׳'],
  ['dimona', 'אזור פיתוח א׳'],
  ['ערד', 'אזור פיתוח א׳'],
  ['arad', 'אזור פיתוח א׳'],
  ['ירוחם', 'אזור פיתוח א׳'],
  ['ofakim', 'אזור פיתוח א׳'],
  ['אופקים', 'אזור פיתוח א׳'],
  ['נתיבות', 'אזור פיתוח א׳'],
  ['netivot', 'אזור פיתוח א׳'],
  ['שדרות', 'אזור פיתוח א׳'],
  ['sderot', 'אזור פיתוח א׳'],
  ['מצפה רמון', 'אזור פיתוח א׳'],
  ['באר שבע', 'אזור פיתוח ב׳'],
  ['beer sheva', 'אזור פיתוח ב׳'],
  ['באר-שבע', 'אזור פיתוח ב׳'],
]);

function roundPoints(value) {
  return Math.round(value * 100) / 100;
}

function childCreditPoints(age) {
  if (!Number.isFinite(age) || age < 0) return 1;
  if (age <= 5) return 1.5;
  if (age <= 17) return 1;
  return 0;
}

/**
 * @param {object|null|undefined} profile UserProfile lean document
 * @param {{ annualWorkIncome?: number|null }} [options]
 */
function buildExpectedTaxCredits(profile, options = {}) {
  const personal = profile?.personal || {};
  const employment = profile?.employment || {};
  const breakdown = [];
  const assumptions = [];
  const missingProfileFields = [];

  const basePoints = 2.25;
  breakdown.push({
    id: 'resident',
    label: 'נקודות בסיס (תושב ישראל)',
    points: basePoints,
    action: null,
  });

  if (personal.gender === 'female') {
    breakdown.push({
      id: 'female',
      label: 'נקודת זיכוי נוספת לאישה',
      points: 0.5,
      action: 'ודא שהמעסיק מזין מין נקבה בטופס 101',
    });
  } else if (!personal.gender) {
    missingProfileFields.push('gender');
    assumptions.push('מין לא צוין — נקודת זיכוי לאישה לא נכללה');
  }

  const childrenAges = Array.isArray(personal.childrenAges) ? personal.childrenAges : [];
  const childrenCount = Number.isFinite(personal.childrenCount) ? personal.childrenCount : null;

  if (childrenAges.length) {
    childrenAges.forEach((age, index) => {
      const pts = childCreditPoints(age);
      if (pts > 0) {
        breakdown.push({
          id: `child_${index}`,
          label: `ילד/ה (גיל ${age})`,
          points: pts,
          action: 'עדכן טופס 101 אצל המעסיק עם פרטי הילדים',
        });
      }
    });
  } else if (childrenCount != null && childrenCount > 0) {
    for (let i = 0; i < childrenCount; i += 1) {
      breakdown.push({
        id: `child_est_${i}`,
        label: `ילד/ה ${i + 1} (הערכה — גיל לא צוין)`,
        points: 1,
        action: 'הזן גילאי ילדים בפרופיל לחישוב מדויק יותר',
      });
    }
    assumptions.push('גילאי ילדים לא צוינו — הוערכה נקודה אחת לכל ילד');
  } else if (childrenCount == null) {
    missingProfileFields.push('childrenCount');
  }

  if (personal.educationLevel === 'first_degree') {
    breakdown.push({
      id: 'first_degree',
      label: 'תואר אקדמי ראשון',
      points: 1,
      action: 'הגש אישור תואר למעסיק או בקשה לנקודות זיכוי ברשות המסים',
    });
  } else if (personal.educationLevel === 'student') {
    breakdown.push({
      id: 'student',
      label: 'סטודנט/ית לתואר ראשון',
      points: 1,
      action: 'בדוק זכאות לנקודות זיכוי לסטודנטים (תלוי שנת לימודים)',
    });
    assumptions.push('זכאות סטודנט מותנית בשנת לימודים ובסטטוס מעסיק');
  } else if (!personal.educationLevel) {
    missingProfileFields.push('educationLevel');
  }

  const annualWorkIncome = Number.isFinite(options.annualWorkIncome)
    ? options.annualWorkIncome
    : null;
  const localityCredit = computeLocalityIncomeCredit(personal.residenceCity, annualWorkIncome);
  if (localityCredit.eligible) {
    breakdown.push({
      id: 'locality_income_credit',
      label: `זיכוי הכנסה ביישוב מזכה — ${localityCredit.locality.name} (${localityCredit.locality.creditPercent}% עד ₪${localityCredit.locality.annualIncomeCap.toLocaleString('he-IL')})`,
      points: 0,
      annualCreditIls: localityCredit.annualCredit,
      action: 'ודא שכתובת המגורים בטופס 101 מעודכנת — הזיכוי לפי סעיף 11 מחושב מהכנסה מיגיעה אישית עד תקרה שנתית',
    });
    if (annualWorkIncome == null) {
      assumptions.push('הכנסה שנתית לא הוערכה — זיכוי היישוב חושב לפי תקרת ההכנסה המלאה');
    }
  } else if (!personal.residenceCity) {
    missingProfileFields.push('residenceCity');
    assumptions.push('עיר מגורים לא צוינה — זיכוי יישובים מזכים (סעיף 11) לא נבדק');
  } else if (!lookupQualifyingLocality(personal.residenceCity)) {
    assumptions.push(`היישוב "${personal.residenceCity}" אינו ברשימת היישובים המזכים לשנת 2026 (או לא זוהה)`);
  }

  const hasChildren = childrenAges.length > 0 || (childrenCount != null && childrenCount > 0);
  if (personal.maritalStatus === 'single' && hasChildren) {
    breakdown.push({
      id: 'single_parent',
      label: 'הורה יחיד',
      points: 1,
      action: 'הגש מסמכים המעידים על הורות יחיד לרשות המסים / מעסיק',
    });
  }

  if (personal.hasCompletedMilitaryService === true && personal.age != null && personal.age <= 34) {
    breakdown.push({
      id: 'military_service',
      label: 'שירות צבאי / לאומי (יתרת זיכוי)',
      points: 0.5,
      action: 'בדוק אם נותרו נקודות זיכוי בגין שירות (עד 3 שנים מסיום השירות)',
    });
    assumptions.push('יתרת זיכוי שירות מוערכת — תלוי בתאריך סיום שירות');
  }

  const totalPoints = roundPoints(breakdown.reduce((sum, item) => sum + item.points, 0));

  return {
    totalPoints,
    monthlyCreditValue: Math.round(totalPoints * MONTHLY_CREDIT_POINT_VALUE),
    annualCreditValue: Math.round(totalPoints * DEFAULT_ANNUAL_CREDIT_POINT_VALUE),
    localityIncomeCredit: localityCredit,
    breakdown,
    assumptions,
    missingProfileFields,
    employmentType: employment.employmentType || null,
    hasMultipleEmployers: employment.hasMultipleEmployers === true,
    hasTaxCoordination: employment.hasTaxCoordination === true,
  };
}

function avgTaxCreditPoints(enrichedList) {
  const points = (enrichedList || [])
    .map(e => e.taxCreditPoints)
    .filter(v => Number.isFinite(v) && v >= 0);
  if (!points.length) return null;
  return roundPoints(points.reduce((a, b) => a + b, 0) / points.length);
}

function estimateAnnualWorkIncome(enrichedList) {
  const grosses = (enrichedList || [])
    .map(e => e.grossSalary ?? e.gross)
    .filter(v => Number.isFinite(v) && v > 0);
  if (!grosses.length) return null;
  const avg = grosses.reduce((a, b) => a + b, 0) / grosses.length;
  return Math.round(avg * 12);
}

/**
 * Build actionable tax-credit insights comparing profile vs payslips.
 */
function buildTaxCreditInsights(profile, enrichedList, options = {}) {
  const annualWorkIncome = options.annualWorkIncome ?? estimateAnnualWorkIncome(enrichedList);
  const expected = buildExpectedTaxCredits(profile, { annualWorkIncome });
  const actualPoints = avgTaxCreditPoints(enrichedList);
  const insights = [];
  const gapThreshold = 0.25;

  const locality = expected.localityIncomeCredit;
  if (locality?.eligible && locality.annualCredit > 0) {
    insights.push({
      id: 'tax_credit_locality_income',
      severity: 'info',
      category: 'payslip',
      title: `זיכוי יישוב מזכה — ${locality.locality.name}`,
      description: locality.explanation,
      recommendation: 'ודא שכתובת המגורים בטופס 101 מעודכנת אצל המעסיק, ושבטופס מופיע היישוב המזכה. הזיכוי הוא אחוז מהכנסה מיגיעה אישית עד תקרה שנתית (לא נקודות זיכוי).',
      financialImpact: locality.annualCredit,
      financialImpactLabel: `עד ~₪${locality.annualCredit.toLocaleString('he-IL')}/שנה זיכוי ממס הכנסה`,
    });
  }

  if (actualPoints == null) {
    insights.push({
      id: 'tax_credits_unknown',
      severity: 'info',
      category: 'payslip',
      title: 'לא נמצאו נקודות זיכוי בתלושים',
      description: 'המערכת לא הצליחה לחלץ נקודות זיכוי מהתלושים. בלי זה קשה לדעת אם המעסיק מנצל את כל הזכויות שלך.',
      recommendation: expected.missingProfileFields.length
        ? 'השלם פרטים בפרופיל (עיר, ילדים, השכלה) ובדוק ידנית את שורת "נקודות זיכוי" בתלוש.'
        : 'בדוק בתלוש את שורת "נקודות זיכוי" והשווה לזכאות הצפויה לפי הפרופיל.',
      financialImpact: null,
      financialImpactLabel: null,
    });
    return { expected, actualPoints, insights, gap: null };
  }

  const gap = roundPoints(expected.totalPoints - actualPoints);

  if (gap >= gapThreshold) {
    const monthlySaving = Math.round(gap * MONTHLY_CREDIT_POINT_VALUE);
    const annualSaving = Math.round(gap * DEFAULT_ANNUAL_CREDIT_POINT_VALUE);
    const likelyMissing = expected.breakdown
      .filter(item => !['resident', 'female', 'locality_income_credit'].includes(item.id))
      .slice(0, 3)
      .map(item => item.label);

    insights.push({
      id: 'tax_credit_gap',
      severity: gap >= 1 ? 'warning' : 'info',
      category: 'payslip',
      title: `פער בנקודות זיכוי: ${actualPoints} בתלוש מול ~${expected.totalPoints} צפוי`,
      description: `לפי הפרופיל שלך מגיעות בערך ${expected.totalPoints} נקודות זיכוי, אך בתלוש מופיעות ${actualPoints}. ייתכן שאתה משלם יותר מס ממה שצריך.`,
      recommendation: [
        'עדכן טופס 101 אצל המעסיק עם כל הזכויות (ילדים, תואר).',
        likelyMissing.length ? `בדוק במיוחד: ${likelyMissing.join(', ')}.` : null,
        gap >= 1 ? 'אם יש ריבוי מעסיקים — הגש בקשה לתיאום מס (טופס 116).' : null,
      ].filter(Boolean).join(' '),
      financialImpact: annualSaving,
      financialImpactLabel: `עד ~₪${annualSaving.toLocaleString('he-IL')}/שנה (${monthlySaving.toLocaleString('he-IL')}/חודש)`,
    });
  } else if (gap <= -gapThreshold) {
    insights.push({
      id: 'tax_credit_high',
      severity: 'info',
      category: 'payslip',
      title: 'נקודות זיכוי בתלוש גבוהות מהצפוי בפרופיל',
      description: `בתלוש ${actualPoints} נקודות לעומת ~${expected.totalPoints} לפי הפרופיל. ייתכן שיש זכויות שלא הוזנו בפרופיל, או תיאום מס פעיל.`,
      recommendation: 'השלם את הפרופיל (ילדים, השכלה, עיר) לניתוח מדויק יותר. אם שילמת יותר מדי במהלך השנה — בדוק החזר מס בדוח השנתי.',
      financialImpact: null,
      financialImpactLabel: null,
    });
  }

  if (gap >= gapThreshold) {
    expected.breakdown.forEach((item) => {
      if (['resident', 'female', 'locality_income_credit'].includes(item.id)) return;
      if (item.id === 'first_degree' || item.id === 'student') {
        insights.push({
          id: 'tax_credit_education',
          severity: 'info',
          category: 'payslip',
          title: 'זיכוי מס בגין תואר אקדמי',
          description: 'תואר ראשון מזכה בנקודת זיכוי אחת (בשנה הרלוונטית). אם לא מופיעה בתלוש — ייתכן שאתה משלם מס עודף.',
          recommendation: item.action,
          financialImpact: null,
          financialImpactLabel: `~₪${DEFAULT_ANNUAL_CREDIT_POINT_VALUE.toLocaleString('he-IL')}/שנה — כלול בהערכת פער נקודות הזיכוי`,
        });
      }
    });
  }

  const employment = profile?.employment || {};
  if (['self_employed', 'business_owner', 'freelancer'].includes(employment.employmentType)) {
    const avgTax = enrichedList.map(e => e.tax).filter(Number.isFinite);
    const hasEmployeeWithholding = avgTax.some(t => t > 0);
    insights.push({
      id: 'tax_self_employed_refund',
      severity: 'info',
      category: 'payslip',
      title: employment.employmentType === 'business_owner' ? 'בעל/ת עסק — בדוק החזרי מס שנתיים' : 'עצמאי/ת עם ניכוי מס בתלוש',
      description: hasEmployeeWithholding
        ? 'יש לך גם הכנסה כשכיר (ניכוי מס בתלוש) וגם פעילות עצמאית. בסוף שנת המס ייתכן תשלום עודף או החזר — תלוי במקדמות ובהוצאות.'
        : 'כעצמאי/ת, מס הכנסה מחושב בדוח שנתי. שמור קבלות והוצאות מוכרות — ייתכן החזר אם שילמת מקדמות גבוהות.',
      recommendation: 'הגש דוח שנתי (טופס 1301/5329), בדוק תיאום מס בין הכנסה שכירה לעסק, ושקול ייעוץ מס לפני סוף שנת המס.',
      financialImpact: null,
      financialImpactLabel: 'פוטנציאל החזר מס שנתי',
    });
  }

  if (employment.hasMultipleEmployers && gap >= 0.5) {
    insights.push({
      id: 'tax_coordination_needed',
      severity: 'warning',
      category: 'payslip',
      title: 'ריבוי מעסיקים + פער בנקודות — סיכון לתשלום מס כפול',
      description: 'כשיש יותר ממעסיק אחד, כל מעסיק מנכה מס בנפרד. בלי תיאום מס (116) קל לשלם יותר מדי.',
      recommendation: 'הגש מיד בקשה לתיאום מס באזור האישי של רשות המסים. צרף תלושים מכל המעסיקים.',
      financialImpact: null,
      financialImpactLabel: gap > 0
        ? `עד ~₪${Math.round(gap * DEFAULT_ANNUAL_CREDIT_POINT_VALUE).toLocaleString('he-IL')}/שנה — כלול בהערכת פער נקודות הזיכוי`
        : 'פוטנציאל החזר מס',
    });
  }

  if (expected.missingProfileFields.length >= 2) {
    insights.push({
      id: 'tax_profile_incomplete',
      severity: 'info',
      category: 'payslip',
      title: 'השלמת פרופיל תשפר את ניתוח המס',
      description: 'חסרים פרטים בפרופיל (עיר מגורים, ילדים, השכלה) — לכן חלק מהזכויות לא נבדקו.',
      recommendation: 'עדכן את הפרופיל באונבורדינג או בהגדרות: עיר מגורים, מספר ילדים, תואר, וסוג תעסוקה.',
      financialImpact: null,
      financialImpactLabel: null,
    });
  }

  return { expected, actualPoints, insights, gap };
}

function formatTaxCreditsForLLM(taxAnalysis) {
  if (!taxAnalysis) return '';
  const { expected, actualPoints, gap } = taxAnalysis;
  const lines = [
    '=== ניתוח נקודות זיכוי מס ===',
    `נקודות צפויות לפי פרופיל: ${expected.totalPoints}`,
    `ערך חודשי משוער (נקודות): ₪${expected.monthlyCreditValue.toLocaleString('he-IL')}`,
  ];
  if (actualPoints != null) {
    lines.push(`נקודות ממוצעות בתלושים: ${actualPoints}`);
    if (gap != null && Math.abs(gap) >= 0.25) {
      lines.push(`פער: ${gap > 0 ? 'חסרות' : 'עודפות'} ${Math.abs(gap)} נקודות`);
    }
  }

  const loc = expected.localityIncomeCredit;
  if (loc?.eligible) {
    lines.push(
      '',
      '=== זיכוי יישוב מזכה (סעיף 11) — לא נקודות זיכוי ===',
      `יישוב: ${loc.locality.name}`,
      `שיעור זיכוי: ${loc.locality.creditPercent}% מהכנסה מיגיעה אישית`,
      `תקרה שנתית: ₪${loc.locality.annualIncomeCap.toLocaleString('he-IL')}`,
      `זיכוי שנתי משוער: ₪${loc.annualCredit.toLocaleString('he-IL')}`,
      loc.explanation,
      'דוגמה: אם מס הכנסה השנתי המחושב הוא ₪36,366 והזיכוי ₪18,480 — המס לתשלום אחרי זיכוי היישוב הוא ₪17,886. אם הזיכוי גבוה מהמס — המס יורד ל־0.',
    );
  } else {
    lines.push('', 'זיכוי יישוב מזכה: לא זוהתה זכאות לפי עיר המגורים בפרופיל');
  }

  lines.push('', 'פירוט זכאות לפי פרופיל:');
  expected.breakdown.forEach((item) => {
    if (item.id === 'locality_income_credit') {
      lines.push(`• ${item.label}: ₪${(item.annualCreditIls || 0).toLocaleString('he-IL')}/שנה${item.action ? ` — ${item.action}` : ''}`);
      return;
    }
    lines.push(`• ${item.label}: ${item.points} נקודות${item.action ? ` — ${item.action}` : ''}`);
  });
  if (expected.assumptions.length) {
    lines.push('', 'הנחות:', ...expected.assumptions.map(a => `• ${a}`));
  }
  return lines.join('\n');
}

module.exports = {
  MONTHLY_CREDIT_POINT_VALUE,
  DEVELOPMENT_ZONE_CITIES,
  buildExpectedTaxCredits,
  avgTaxCreditPoints,
  buildTaxCreditInsights,
  formatTaxCreditsForLLM,
  estimateAnnualWorkIncome,
};
