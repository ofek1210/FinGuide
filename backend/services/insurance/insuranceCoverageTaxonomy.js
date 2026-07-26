'use strict';

/**
 * Normalized coverage families for duplicate / overlap analysis.
 * Never collapse to broad Har HaBituach branches (vehicle / health / life).
 */

const COVERAGE_FAMILIES = Object.freeze({
  VEHICLE_COMPULSORY: 'vehicle_compulsory',
  VEHICLE_COMPREHENSIVE: 'vehicle_comprehensive',
  VEHICLE_THIRD_PARTY: 'vehicle_third_party',
  VEHICLE_SERVICES: 'vehicle_services',
  HOME_STRUCTURE: 'home_structure',
  HOME_CONTENTS: 'home_contents',
  HEALTH_SURGERY: 'health_surgery',
  HEALTH_MEDICATIONS: 'health_medications',
  HEALTH_TRANSPLANTS: 'health_transplants',
  HEALTH_AMBULATORY: 'health_ambulatory',
  PERSONAL_ACCIDENT: 'personal_accident',
  LONG_TERM_CARE: 'long_term_care',
  MEDICAL_SERVICE: 'medical_service',
  LIFE_DEATH: 'life_death',
  LIFE_ACCIDENTAL_DEATH: 'life_accidental_death',
  DISABILITY_INCOME: 'disability_income',
  UNKNOWN: 'unknown',
});

const VEHICLE_FAMILIES = new Set([
  COVERAGE_FAMILIES.VEHICLE_COMPULSORY,
  COVERAGE_FAMILIES.VEHICLE_COMPREHENSIVE,
  COVERAGE_FAMILIES.VEHICLE_THIRD_PARTY,
  COVERAGE_FAMILIES.VEHICLE_SERVICES,
]);

const FAMILY_LABELS_HE = {
  [COVERAGE_FAMILIES.VEHICLE_COMPULSORY]: 'ביטוח חובה לרכב',
  [COVERAGE_FAMILIES.VEHICLE_COMPREHENSIVE]: 'ביטוח מקיף לרכב',
  [COVERAGE_FAMILIES.VEHICLE_THIRD_PARTY]: 'צד ג׳ לרכב',
  [COVERAGE_FAMILIES.VEHICLE_SERVICES]: 'שירותי רכב',
  [COVERAGE_FAMILIES.HOME_STRUCTURE]: 'מבנה',
  [COVERAGE_FAMILIES.HOME_CONTENTS]: 'תכולה',
  [COVERAGE_FAMILIES.HEALTH_SURGERY]: 'ניתוחים',
  [COVERAGE_FAMILIES.HEALTH_MEDICATIONS]: 'תרופות',
  [COVERAGE_FAMILIES.HEALTH_TRANSPLANTS]: 'השתלות',
  [COVERAGE_FAMILIES.HEALTH_AMBULATORY]: 'אמבולטורי',
  [COVERAGE_FAMILIES.PERSONAL_ACCIDENT]: 'תאונות אישיות',
  [COVERAGE_FAMILIES.LONG_TERM_CARE]: 'סיעוד',
  [COVERAGE_FAMILIES.MEDICAL_SERVICE]: 'שירות רפואי / נספח',
  [COVERAGE_FAMILIES.LIFE_DEATH]: 'ביטוח חיים',
  [COVERAGE_FAMILIES.LIFE_ACCIDENTAL_DEATH]: 'מוות מתאונה',
  [COVERAGE_FAMILIES.DISABILITY_INCOME]: 'אובדן כושר עבודה',
  [COVERAGE_FAMILIES.UNKNOWN]: 'לא מסווג',
};

const CLASSIFICATION_RULES = [
  { family: COVERAGE_FAMILIES.VEHICLE_COMPULSORY, patterns: ['חובה', 'ביטוח חובה'] },
  { family: COVERAGE_FAMILIES.VEHICLE_COMPREHENSIVE, patterns: ['מקיף', 'ביטוח מקיף'] },
  { family: COVERAGE_FAMILIES.VEHICLE_THIRD_PARTY, patterns: ['צד ג', 'צד שלישי', 'חובה מקיף'] },
  { family: COVERAGE_FAMILIES.VEHICLE_SERVICES, patterns: ['שירותי דרך', 'גריר', 'רכב חלופי', 'שמשות', 'חלופי'] },
  { family: COVERAGE_FAMILIES.LONG_TERM_CARE, patterns: ['סיעוד', 'אריכות ימים', 'תלות'] },
  { family: COVERAGE_FAMILIES.PERSONAL_ACCIDENT, patterns: ['תאונות אישיות', 'תאונה אישית', 'ת"א', 'תאונת'] },
  { family: COVERAGE_FAMILIES.MEDICAL_SERVICE, patterns: ['שירות רפואי', 'שירותים', 'ייעוץ', 'בדיקות'] },
  { family: COVERAGE_FAMILIES.HEALTH_TRANSPLANTS, patterns: ['השתלות', 'השתלת'] },
  { family: COVERAGE_FAMILIES.HEALTH_MEDICATIONS, patterns: ['תרופות מחוץ לסל', 'מחוץ לסל', 'תרופות'] },
  { family: COVERAGE_FAMILIES.HEALTH_SURGERY, patterns: ['ניתוחים בחו"ל', 'ניתוח בחו"ל', 'ניתוחים פרטיים', 'ניתוחים בישראל', 'ניתוח פרטי', 'השת"פ'] },
  { family: COVERAGE_FAMILIES.HEALTH_AMBULATORY, patterns: ['אמבולטורי', 'ייעוץ', 'התייעצות'] },
  { family: COVERAGE_FAMILIES.LIFE_ACCIDENTAL_DEATH, patterns: ['מוות מתאונה', 'מוות ב', 'רiders_accident'] },
  { family: COVERAGE_FAMILIES.LIFE_DEATH, patterns: ['ביטוח חיים', 'ריסק', 'חיים', 'קבוצתי', 'עמיתים'] },
  { family: COVERAGE_FAMILIES.DISABILITY_INCOME, patterns: ['אכ"ע', 'אובדן כושר', 'נכות'] },
  { family: COVERAGE_FAMILIES.HOME_STRUCTURE, patterns: ['מבנה', 'דירה'] },
  { family: COVERAGE_FAMILIES.HOME_CONTENTS, patterns: ['תכולה'] },
];

function normalizeText(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/["״''`]/g, '"')
    .replace(/\s+/g, ' ');
}

function policyTextBlob(policy, riderLabel) {
  const raw = policy.rawData || {};
  return [
    riderLabel,
    raw.mainBranch,
    raw.subBranch,
    raw.productType,
    raw.planClass,
    raw.extra,
    raw.label,
    raw.classification,
    policy.type,
    policy.notes,
  ].filter(Boolean).join(' ');
}

/**
 * @returns {string[]} coverage family ids
 */
function classifyCoverageFamilies(policy, riderLabel) {
  const blob = normalizeText(policyTextBlob(policy, riderLabel));
  const families = new Set();

  for (const rule of CLASSIFICATION_RULES) {
    if (rule.patterns.some(p => blob.includes(normalizeText(p)))) {
      families.add(rule.family);
    }
  }

  if (families.size === 0) {
    if (policy.type === 'car') {
      if (blob.includes('חובה')) families.add(COVERAGE_FAMILIES.VEHICLE_COMPULSORY);
      else if (blob.includes('מקיף')) families.add(COVERAGE_FAMILIES.VEHICLE_COMPREHENSIVE);
      else families.add(COVERAGE_FAMILIES.UNKNOWN);
    } else if (policy.type === 'life') {
      families.add(COVERAGE_FAMILIES.LIFE_DEATH);
    } else if (policy.type === 'health') {
      families.add(COVERAGE_FAMILIES.UNKNOWN);
    } else {
      families.add(COVERAGE_FAMILIES.UNKNOWN);
    }
  }

  return [...families];
}

function labelCoverageFamily(family) {
  return FAMILY_LABELS_HE[family] || family;
}

function isVehicleFamily(family) {
  return VEHICLE_FAMILIES.has(family);
}

module.exports = {
  COVERAGE_FAMILIES,
  VEHICLE_FAMILIES,
  FAMILY_LABELS_HE,
  classifyCoverageFamilies,
  labelCoverageFamily,
  isVehicleFamily,
  normalizeText,
};
