'use strict';

/**
 * Dynamic insurance onboarding — question bank + report-aware filtering.
 * Questions are generated AFTER Har HaBituach import; never ask what the report already answers.
 */

const PROFILE_PATHS = {
  'assets.ownsApartment': p => p.assets?.ownsApartment,
  'assets.ownsCar': p => p.assets?.ownsCar,
  'assets.hasMortgage': p => p.assets?.hasMortgage,
  'assets.mortgageMonthlyPayment': p => p.assets?.mortgageMonthlyPayment,
  'personal.maritalStatus': p => p.personal?.maritalStatus,
  'personal.childrenCount': p => p.personal?.childrenCount,
  'personal.age': p => p.personal?.age,
  'personal.isSmoker': p => p.personal?.isSmoker,
  'personal.occupation': p => p.personal?.occupation,
  'financial.salaryRange': p => p.financial?.salaryRange,
  'financial.monthlyDebts': p => p.financial?.monthlyDebts,
  'financial.savingsEstimate': p => p.financial?.savingsEstimate,
};

function isAnswered(profile, onboarding, path) {
  if (onboarding?.answers?.[path] != null) return true;
  if (onboarding?.skippedIds?.includes(path)) return true;
  const getter = PROFILE_PATHS[path];
  if (getter) {
    const v = getter(profile);
    return v != null && v !== '';
  }
  return onboarding?.answers?.[path] != null;
}

function q(id, fields) {
  return { id, skipAllowed: true, ...fields };
}

/** All possible questions — filtered at runtime by report + existing profile. */
function buildQuestionBank(ctx) {
  const { hasApartment, hasCar, hasLife, hasHealth, hasDisability } = ctx;
  const bank = [];

  // ── Agent 1: General — Home ─────────────────────────────────────────────
  if (!hasApartment) {
    bank.push(
      q('home.owns_home', {
        agent: 'general',
        category: 'home',
        text: 'האם יש לך דירה בבעלות?',
        why: 'ביטוח מבנה ותכולה רלוונטיים רק כשיש נכס — נזהה אם חסרה לך הגנה.',
        type: 'boolean',
        profilePath: 'assets.ownsApartment',
      }),
      q('home.rents', {
        agent: 'general',
        category: 'home',
        text: 'האם אתה שוכר דירה כיום?',
        why: 'שוכרים זקוקים לעיתים לביטוח תכולה — גם בלי ביטוח מבנה.',
        type: 'boolean',
        profilePath: 'insuranceOnboarding.home.rents',
        when: p => p.assets?.ownsApartment === false,
      }),
      q('home.mortgage', {
        agent: 'general',
        category: 'home',
        text: 'האם יש משכנתא על הנכס?',
        why: 'משכנתא משפיעה על סכום הביטוח הנדרש לכיסוי המבנה.',
        type: 'boolean',
        profilePath: 'assets.hasMortgage',
        when: p => p.assets?.ownsApartment === true,
      }),
      q('home.property_value', {
        agent: 'general',
        category: 'home',
        text: 'מה שווי הנכס המשוער? (₪)',
        why: 'מאפשר לבדוק אם סכום הביטוח תואם את שווי הנכס.',
        type: 'number',
        profilePath: 'insuranceOnboarding.home.propertyValue',
        when: p => p.assets?.ownsApartment === true,
      }),
      q('home.contents_value', {
        agent: 'general',
        category: 'home',
        text: 'מה שווי התכולה בבית? (₪)',
        why: 'תכולה יקרה ללא כיסוי = סיכון כלכלי גבוה.',
        type: 'number',
        profilePath: 'insuranceOnboarding.home.contentsValue',
      }),
    );
  } else {
    bank.push(
      q('home.primary_residence', {
        agent: 'general',
        category: 'home',
        text: 'האם זו עדיין דירת המגורים העיקרית שלך?',
        why: 'שינוי מגורים עלול להפוך את הפוליסה הקיימת ללא מתאימה.',
        type: 'boolean',
        profilePath: 'insuranceOnboarding.home.primaryResidence',
      }),
      q('home.renovated', {
        agent: 'general',
        category: 'home',
        text: 'האם שיפצת את הנכס לאחרונה?',
        why: 'שיפוץ מעלה את שווי הנכס — ייתכן שצריך לעדכן כיסוי.',
        type: 'boolean',
        profilePath: 'insuranceOnboarding.home.recentRenovation',
      }),
      q('home.expensive_purchases', {
        agent: 'general',
        category: 'home',
        text: 'האם רכשת לאחרונה ריהוט או אלקטרוניקה יקרים?',
        why: 'רכישות גדולות דורשות לעיתים הגדלת כיסוי תכולה.',
        type: 'boolean',
        profilePath: 'insuranceOnboarding.home.expensivePurchases',
      }),
    );
  }

  // ── Agent 1: Vehicle ──────────────────────────────────────────────────────
  if (!hasCar) {
    bank.push(
      q('vehicle.owns', {
        agent: 'general',
        category: 'vehicle',
        text: 'האם יש לך רכב?',
        why: 'בלי רכב — ביטוח רכב לא נדרש; עם רכב — נבדוק אם חסר כיסוי.',
        type: 'boolean',
        profilePath: 'assets.ownsCar',
      }),
      q('vehicle.year', {
        agent: 'general',
        category: 'vehicle',
        text: 'שנת ייצור הרכב',
        why: 'שנתון משפיעה על עלות ביטוח מקיף וחובה.',
        type: 'number',
        profilePath: 'insuranceOnboarding.vehicle.year',
        when: p => p.assets?.ownsCar === true,
      }),
      q('vehicle.estimated_value', {
        agent: 'general',
        category: 'vehicle',
        text: 'שווי שוק משוער (₪)',
        why: 'משמש להערכת התאמת ביטוח מקיף.',
        type: 'number',
        profilePath: 'insuranceOnboarding.vehicle.marketValue',
        when: p => p.assets?.ownsCar === true,
      }),
      q('vehicle.young_drivers', {
        agent: 'general',
        category: 'vehicle',
        text: 'האם נוהגים בגיל מתחת ל-24 באופן קבוע?',
        why: 'נהגים צעירים מעלים סיכון ופרמיה.',
        type: 'boolean',
        profilePath: 'insuranceOnboarding.vehicle.youngDrivers',
        when: p => p.assets?.ownsCar === true,
      }),
    );
  } else {
    bank.push(
      q('vehicle.still_owns', {
        agent: 'general',
        category: 'vehicle',
        text: 'האם עדיין בבעלותך הרכב שמופיע בדוח?',
        why: 'מכירת רכב = פוליסה מיותרת.',
        type: 'boolean',
        profilePath: 'insuranceOnboarding.vehicle.stillOwns',
      }),
      q('vehicle.financed', {
        agent: 'general',
        category: 'vehicle',
        text: 'האם הרכב ממומן (הלוואה / ליסינג)?',
        why: 'מימון דורש לעיתים כיסוי מקיף מלא.',
        type: 'boolean',
        profilePath: 'insuranceOnboarding.vehicle.financed',
      }),
      q('vehicle.annual_km', {
        agent: 'general',
        category: 'vehicle',
        text: 'כמה ק״מ אתה נוסע בשנה (בערך)?',
        why: 'נסיעה intensiva משפיעה על פרופיל הסיכון.',
        type: 'number',
        profilePath: 'insuranceOnboarding.vehicle.annualKm',
      }),
    );
  }

  // ── Agent 2: Life ─────────────────────────────────────────────────────────
  if (!hasLife) {
    bank.push(
      q('life.explain', {
        agent: 'life',
        category: 'life',
        text: 'ביטוח חיים מגן על המשפחה אם יקרה משהו לך — נבדוק אם צריך כיסוי.',
        why: 'הסבר קצר לפני שאלות — לא דורש תשובה.',
        type: 'info',
        profilePath: null,
      }),
    );
  }

  bank.push(
    q('life.marital_status', {
      agent: 'life',
      category: 'life',
      text: 'מה מצבך המשפחתי?',
      why: 'מצב משפחתי קובע את גובה ההגנה הכלכלית הנדרשת.',
      type: 'select',
      options: [
        { value: 'single', label: 'רווק/ה' },
        { value: 'married', label: 'נשוי/אה' },
        { value: 'partnered', label: 'בזוגיות' },
        { value: 'divorced', label: 'גרוש/ה' },
        { value: 'widowed', label: 'אלמן/ה' },
      ],
      profilePath: 'personal.maritalStatus',
    }),
    q('life.children_count', {
      agent: 'life',
      category: 'life',
      text: 'כמה ילדים יש לך?',
      why: 'ילדים = תלות כלכלית — משפיע על סכום ביטוח חיים.',
      type: 'number',
      profilePath: 'personal.childrenCount',
    }),
    q('life.income_dependents', {
      agent: 'life',
      category: 'life',
      text: 'האם מישהו תלוי בהכנסה שלך?',
      why: 'תלות כלכלית = צורך בכיסוי חיים גבוה יותר.',
      type: 'boolean',
      profilePath: 'insuranceOnboarding.life.incomeDependents',
    }),
    q('life.mortgage_amount', {
      agent: 'life',
      category: 'life',
      text: 'יתרת משכנתא (₪)',
      why: 'משכנתא גבוהה דורשת כיסוי שיאזן את החוב.',
      type: 'number',
      profilePath: 'insuranceOnboarding.life.mortgageBalance',
      when: p => p.assets?.hasMortgage === true,
    }),
    q('life.employer_life', {
      agent: 'life',
      category: 'life',
      text: 'האם יש לך ביטוח חיים דרך המעסיק?',
      why: 'כיסוי מעסיק מפחית את הצורך בפוליסה פרטית.',
      type: 'boolean',
      profilePath: 'insuranceOnboarding.life.employerProvided',
    }),
  );

  // Personal accident / disability
  if (hasDisability) {
    bank.push(
      q('accident.high_risk_job', {
        agent: 'life',
        category: 'accident',
        text: 'האם עיסוקך נחשב מסוכן?',
        why: 'עיסוק מסוכן משנה את רלוונטיות ביטוח תאונות.',
        type: 'boolean',
        profilePath: 'insuranceOnboarding.accident.highRiskOccupation',
      }),
      q('accident.extreme_sports', {
        agent: 'life',
        category: 'accident',
        text: 'האם אתה עוסק בספורט אתגרי?',
        why: 'ספורט אתגרי = סיכון שלא תמיד מכוסה.',
        type: 'boolean',
        profilePath: 'insuranceOnboarding.accident.extremeSports',
      }),
    );
  }

  // ── Agent 3: Health ───────────────────────────────────────────────────────
  bank.push(
    q('health.age', {
      agent: 'health',
      category: 'health',
      text: 'מה גילך?',
      why: 'גיל הוא בסיס לבדיקת התאמת ביטוח בריאות.',
      type: 'number',
      profilePath: 'personal.age',
    }),
    q('health.smoker', {
      agent: 'health',
      category: 'health',
      text: 'האם אתה מעשן?',
      why: 'עישון משפיע על פרמיה וכיסויים — לא תמיד מופיע בדוח.',
      type: 'boolean',
      profilePath: 'personal.isSmoker',
    }),
    q('health.activity', {
      agent: 'health',
      category: 'health',
      text: 'רמת פעילות גופנית',
      why: 'אורח חיים בריא מוריד סיכון — רלוונטי לכיסוי משלים.',
      type: 'select',
      options: [
        { value: 'low', label: 'נמוכה' },
        { value: 'medium', label: 'בינונית' },
        { value: 'high', label: 'גבוהה' },
      ],
      profilePath: 'insuranceOnboarding.health.activityLevel',
    }),
    q('health.conditions', {
      agent: 'health',
      category: 'health',
      text: 'האם יש לך אחת או יותר מהמחלות הבאות?',
      why: 'מצב רפואי קובע אם הכיסוי הקיים מספיק.',
      type: 'multiselect',
      options: [
        { value: 'diabetes', label: 'סוכרת' },
        { value: 'hypertension', label: 'לחץ דם גבוה' },
        { value: 'heart', label: 'מחלות לב' },
        { value: 'cancer', label: 'סרטן (עבר / נוכחי)' },
        { value: 'asthma', label: 'אסטמה' },
        { value: 'none', label: 'אין' },
      ],
      profilePath: 'insuranceOnboarding.health.conditions',
    }),
    q('health.hospitalization', {
      agent: 'health',
      category: 'health',
      text: 'האם אושפזת בחמש השנים האחרונות?',
      why: 'אשפוז לאחרונה עלול לדרוש כיסוי משלים — לא תמיד מופיע בדוח.',
      type: 'boolean',
      profilePath: 'insuranceOnboarding.health.recentHospitalization',
    }),
    q('health.supplemental', {
      agent: 'health',
      category: 'health',
      text: 'האם יש לך ביטוח משלים / ביטוח קולקטיבי מהמעסיק?',
      why: 'כיסוי קיים מקטין פערים — לא תמיד מופיע בדוח.',
      type: 'boolean',
      profilePath: 'insuranceOnboarding.health.employerHealth',
    }),
  );

  if (hasHealth) {
    bank.push(
      q('health.critical_illness', {
        agent: 'health',
        category: 'health',
        text: 'האם יש לך ביטוח מחלות קשות?',
        why: 'מחלות קשות דורשות כיסוי ייעודי — נבדוק אם קיים.',
        type: 'boolean',
        profilePath: 'insuranceOnboarding.health.criticalIllness',
      }),
    );
  }

  return bank;
}

function filterQuestions(bank, profile, onboarding, ctx) {
  const merged = mergeProfileForWhen(profile, onboarding);
  return bank.filter(question => {
    if (question.type === 'info') return !onboarding?.answers?.[question.id];
    if (isAnswered(profile, onboarding, question.profilePath || question.id)) return false;
    if (question.when && !question.when(merged)) return false;
    return true;
  });
}

function mergeProfileForWhen(profile, onboarding) {
  const p = profile?.toObject ? profile.toObject() : { ...profile };
  const answers = onboarding?.answers || {};
  const flat = {};
  for (const [k, v] of Object.entries(answers)) {
    if (k.startsWith('assets.')) {
      flat.assets = flat.assets || { ...p.assets };
      flat.assets[k.replace('assets.', '')] = v;
    } else if (k.startsWith('personal.')) {
      flat.personal = flat.personal || { ...p.personal };
      flat.personal[k.replace('personal.', '')] = v;
    }
  }
  return {
    ...p,
    assets: { ...p.assets, ...flat.assets },
    personal: { ...p.personal, ...flat.personal },
    insuranceOnboarding: { ...(p.insuranceOnboarding || {}), ...(answers.insuranceOnboarding || {}) },
  };
}

module.exports = {
  buildQuestionBank,
  filterQuestions,
  isAnswered,
  mergeProfileForWhen,
};
