const UserProfile = require('../models/UserProfile');
const Recommendation = require('../models/Recommendation');
const Insight = require('../models/Insight');

function getProfileContext(profile) {
  const p = profile?.personal || {};
  const a = profile?.assets || {};
  const i = profile?.insurance || {};
  const e = profile?.employment || {};
  const r = profile?.retirement || {};
  return { personal: p, assets: a, insurance: i, employment: e, retirement: r };
}

function buildDraft(kind, importance, title, reasoning, coverageEstimate) {
  return {
    kind,
    importance,
    title,
    reasoning,
    priceRange: null,
    coverageEstimate: coverageEstimate ?? null,
  };
}

async function evaluateRules(profile, { hasLowPensionInsight } = {}) {
  const { personal, assets, insurance, employment } = getProfileContext(profile);
  const { age } = personal;
  const children = personal.childrenCount || 0;
  const gross = employment.expectedMonthlyGross;
  const drafts = [];

  const needsLife =
    (children > 0 || assets.hasMortgage === true || personal.hasDependents === true
      || ['married', 'partnered'].includes(personal.maritalStatus))
    && insurance.hasLifeInsurance === false;
  const explicitlyNoLife = personal.maritalStatus === 'single'
    && children === 0
    && personal.hasDependents !== true
    && assets.hasMortgage !== true;

  if (needsLife && !explicitlyNoLife) {
    drafts.push(
      buildDraft(
        'life',
        children > 0 && assets.hasMortgage ? 'critical' : 'high',
        'ביטוח חיים',
        [
          children > 0 ? 'יש לך ילדים — ביטוח חיים מגן על המשפחה במקרה חרום.' : '',
          personal.hasDependents ? 'יש תלויים כלכלית — כיסוי חיים מגן עליהם.' : '',
          ['married', 'partnered'].includes(personal.maritalStatus) ? 'מצב משפחתי מצביע על שותף/ה שעלול/ה להיפגע כלכלית.' : '',
          assets.hasMortgage ? 'יש משכנתא — ביטוח חיים יכול לכסות את יתרת ההלוואה.' : '',
        ].filter(Boolean),
        gross ? gross * 120 : null,
      ),
    );
  }

  if (insurance.hasHealthInsurance === false && age != null && age > 30) {
    drafts.push(
      buildDraft(
        'health',
        'high',
        'ביטוח בריאות משלים',
        ['לא דווח על ביטוח בריאות פרטי.', 'בגילך מומלץ לשקול כיסוי משלים לטיפולים וניתוחים.'],
        null,
      ),
    );
  }

  if (
    employment.isPrimaryJob === true &&
    age != null &&
    age < 60 &&
    insurance.hasDisabilityInsurance === false
  ) {
    drafts.push(
      buildDraft(
        'disability',
        'high',
        'ביטוח אובדן כושר עבודה',
        ['זו העבודה העיקרית שלך.', 'אובדן כושר מגן על הכנסה במקרה של פגיעה או מחלה ממושכת.'],
        gross ? gross * 0.75 : null,
      ),
    );
  }

  if (assets.ownsApartment === true && insurance.hasApartmentInsurance === false) {
    drafts.push(
      buildDraft(
        'apartment',
        'critical',
        'ביטוח דירה / תכולה',
        ['בבעלותך דירה ללא ביטוח מדווח.', 'ביטוח מבנה ותכולה מגן מפני נזקי אש, מים וגניבה.'],
        null,
      ),
    );
  }

  if (assets.ownsCar === true && insurance.hasCarInsurance === false) {
    drafts.push(
      buildDraft(
        'car',
        'critical',
        'ביטוח רכב חובה + מקיף',
        ['בבעלותך רכב ללא ביטוח מדווח.', 'ביטוח חובה הוא חובה בחוק; מקיף מגן על נזק לרכב.'],
        null,
      ),
    );
  }

  if (hasLowPensionInsight) {
    drafts.push(
      buildDraft(
        'pension_increase',
        'medium',
        'הגדלת הפרשה לפנסיה',
        ['הפרשת הפנסיה בתלוש נמוכה מהמומלץ (6%).', 'שקול לדבר עם המעסיק על הגדלת ההפרשה.'],
        null,
      ),
    );
  }

  return drafts;
}

async function upsertRecommendations(userId, drafts) {
  const notificationService = require('./notificationService');
  const results = [];

  for (const draft of drafts) {
    const existing = await Recommendation.findOne({
      user: userId,
      kind: draft.kind,
      status: 'active',
    });

    if (existing) {
      existing.importance = draft.importance;
      existing.title = draft.title;
      existing.reasoning = draft.reasoning;
      existing.priceRange = draft.priceRange;
      existing.coverageEstimate = draft.coverageEstimate;
      existing.lastEvaluatedAt = new Date();
      await existing.save();
      results.push(existing);
    } else {
      const rec = await Recommendation.create({ user: userId, ...draft });
      results.push(rec);
      if (notificationService?.notifyRecommendationNew) {
        await notificationService.notifyRecommendationNew(userId, rec).catch(() => {});
      }
    }
  }

  return results;
}

async function run(userId) {
  const profile = await UserProfile.findOne({ user: userId });
  if (!profile) return [];

  const hasLowPensionInsight = await Insight.exists({
    user: userId,
    kind: { $in: ['pension_low', 'pension_missing'] },
    status: 'active',
  });

  const drafts = await evaluateRules(profile, { hasLowPensionInsight: Boolean(hasLowPensionInsight) });
  return upsertRecommendations(userId, drafts);
}

module.exports = { evaluateRules, run, upsertRecommendations };
