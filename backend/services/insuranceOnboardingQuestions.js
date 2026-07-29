'use strict';

/**
 * Insurance onboarding — the short risk questionnaire that the Har HaBituach report
 * cannot answer: how many vehicles the user owns, smoking, physical activity,
 * medical conditions and the need for life insurance.
 */

const PROFILE_PATHS = {
  'personal.isSmoker': p => p.personal?.isSmoker,
};

const LIFE_INSURANCE_EXPLANATION_HE = 'ביטוח חיים משלם סכום כספי לשאירים אם יקרה לך משהו. '
  + 'הוא נחוץ בעיקר למי שיש מי שתלוי בו כלכלית — בן/בת זוג, ילדים או הורים — '
  + 'ולמי שיש הון והתחייבויות שצריך להגן עליהם, כמו משכנתא, הלוואות או עסק. '
  + 'מי שחי לבד, בלי תלויים ובלי חובות, לרוב לא זקוק לו.';

function isAnswered(profile, onboarding, path) {
  if (onboarding?.answers?.[path] != null) return true;
  if (onboarding?.skippedIds?.includes(path)) return true;
  const getter = PROFILE_PATHS[path];
  if (getter) {
    const v = getter(profile);
    return v != null && v !== '';
  }
  return false;
}

function q(id, fields) {
  return { id, skipAllowed: true, ...fields };
}

/** The full question bank — filtered at runtime by what the profile already knows. */
function buildQuestionBank({ hasCar = false } = {}) {
  const bank = [];

  // Only relevant when the report already shows car policies — the count tells us
  // whether several car policies are a duplicate or simply different vehicles.
  if (hasCar) {
    bank.push(q('vehicle.vehicles_owned', {
      agent: 'general',
      category: 'vehicle',
      text: 'כמה רכבים רשומים כיום על שמך?',
      why: 'מספר הרכבים נדרש כדי לבדוק אם מספר פוליסות הרכב בדוח מייצג כפילות או רכבים שונים.',
      type: 'number',
      profilePath: 'insuranceOnboarding.vehicle.vehiclesOwned',
    }));
  }

  bank.push(
    q('health.smoker', {
      agent: 'health',
      category: 'health',
      text: 'האם אתה מעשן?',
      why: 'עישון משפיע על הפרמיה ועל תנאי הכיסוי — ואינו מופיע בדוח הר הביטוח.',
      type: 'boolean',
      profilePath: 'personal.isSmoker',
    }),
    q('health.activity', {
      agent: 'health',
      category: 'health',
      text: 'רמת פעילות גופנית',
      why: 'אורח חיים פעיל מוריד את פרופיל הסיכון — רלוונטי לביטוח בריאות ולביטוח חיים.',
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
      why: 'מצב רפואי קיים קובע אם הכיסוי הביטוחי הנוכחי מספיק.',
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
    q('life.needs_life_insurance', {
      agent: 'life',
      category: 'life',
      text: 'האם אתה זקוק לביטוח חיים?',
      why: LIFE_INSURANCE_EXPLANATION_HE,
      type: 'boolean',
      profilePath: 'insuranceOnboarding.life.needsLifeInsurance',
    }),
  );

  return bank;
}

function filterQuestions(bank, profile, onboarding) {
  return bank.filter(question => {
    if (onboarding?.skippedIds?.includes(question.id)) return false;
    return !isAnswered(profile, onboarding, question.profilePath || question.id);
  });
}

module.exports = {
  buildQuestionBank,
  filterQuestions,
  isAnswered,
  LIFE_INSURANCE_EXPLANATION_HE,
};
