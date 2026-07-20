'use strict';

/** Weights for global priority scoring (higher score = more important). */
const PRIORITY_WEIGHTS = {
  financialImpact: 0.35,
  urgency: 0.25,
  longTermEffect: 0.15,
  monthlySavings: 0.1,
  retirementImpact: 0.08,
  insuranceRisk: 0.05,
  confidence: 0.07,
};

const URGENCY_SCORE = {
  immediate: 100,
  soon: 75,
  planned: 50,
  long_term: 25,
};

const SEVERITY_SCORE = {
  critical: 100,
  high: 85,
  medium: 60,
  low: 35,
  info: 15,
};

const CATEGORY_BOOST = {
  pension_fees: 12,
  retirement: 10,
  insurance_waste: 9,
  tax: 8,
  cash_flow: 7,
  investment: 6,
  consolidation: 6,
  coverage_gap: 8,
  data_quality: 3,
};

const MERGE_GROUPS = [
  { key: 'insurance_cost', patterns: [/ביטוח/i, /פרמיה/i, /כפל/i, /ביטוחי/i] },
  { key: 'cash_flow', patterns: [/תזרים/i, /חודש/i, /הוצא/i, /מזומן/i] },
  { key: 'pension_fees', patterns: [/דמי ניהול/i, /פנסיה/i, /ניוד/i, /איחוד/i] },
  { key: 'study_fund', patterns: [/השתלמות/i, /גמל/i] },
  { key: 'tax', patterns: [/מס/i, /החזר/i, /תיאום/i] },
  { key: 'emergency', patterns: [/חירום/i, /כרית/i] },
];

const ROADMAP_BUCKETS = {
  immediate: ['immediate'],
  within30Days: ['soon'],
  within3Months: ['planned'],
  longTerm: ['long_term'],
};

const MAX_PRIORITY_ACTIONS = 8;

const REVIEW_ITEMS = [
  'דמי ניהול בפנסיה, גמל והשתלמות',
  'חידושי ביטוח ופרמיות',
  'שינויי שכר והפרשות מהתלוש',
  'עדכוני מס והחזרים',
  'הקצאת השקעות ומזומן עודף',
  'תחזית פרישה וחיסכון לטווח ארוך',
];

module.exports = {
  PRIORITY_WEIGHTS,
  URGENCY_SCORE,
  SEVERITY_SCORE,
  CATEGORY_BOOST,
  MERGE_GROUPS,
  ROADMAP_BUCKETS,
  MAX_PRIORITY_ACTIONS,
  REVIEW_ITEMS,
};
