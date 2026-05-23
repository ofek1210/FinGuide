const { ValidationError } = require('./appErrors');
const UserProfile = require('../models/UserProfile');

const { STRING_ENUMS } = UserProfile;

const ALL_FIELDS = {
  personal: {
    fullName: { type: 'string', maxLength: 120 },
    age: { type: 'number', min: 16, max: 120 },
    occupation: { type: 'string', maxLength: 120 },
    maritalStatus: { type: 'enum', values: STRING_ENUMS.maritalStatus },
    childrenCount: { type: 'number', min: 0, max: 20, integer: true },
  },
  financial: {
    salaryRange: { type: 'enum', values: STRING_ENUMS.salaryRange },
    monthlyExpensesEstimate: { type: 'number', min: 0, max: 1000000 },
    savingsEstimate: { type: 'number', min: 0, max: 100000000 },
  },
  assets: {
    ownsApartment: { type: 'boolean' },
    ownsCar: { type: 'boolean' },
    hasMortgage: { type: 'boolean' },
    mortgageMonthlyPayment: { type: 'number', min: 0, max: 500000 },
  },
  insurance: {
    hasLifeInsurance: { type: 'boolean' },
    hasHealthInsurance: { type: 'boolean' },
    hasDisabilityInsurance: { type: 'boolean' },
    hasApartmentInsurance: { type: 'boolean' },
    hasCarInsurance: { type: 'boolean' },
  },
  retirement: {
    hasPension: { type: 'boolean' },
    hasStudyFund: { type: 'boolean' },
    hasInvestmentFunds: { type: 'boolean' },
    investmentTypes: { type: 'string-array', values: STRING_ENUMS.investmentType },
  },
  employment: {
    salaryType: { type: 'enum', values: STRING_ENUMS.salaryType },
    expectedMonthlyGross: { type: 'number', min: 0, max: 500000 },
    hourlyRate: { type: 'number', min: 0, max: 5000 },
    expectedMonthlyHours: { type: 'number', min: 0, max: 400 },
    jobPercentage: { type: 'number', min: 0, max: 100 },
    isPrimaryJob: { type: 'boolean' },
    hasMultipleEmployers: { type: 'boolean' },
    employmentStartDate: { type: 'date-string' },
  },
};

const SECTION_NAMES = Object.keys(ALL_FIELDS);

const isValidDateString = value => {
  if (typeof value !== 'string') return false;
  const s = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const t = new Date(s).getTime();
  return !Number.isNaN(t);
};

const checkField = (sectionName, fieldName, rule, value, errors) => {
  if (value == null) return;
  const path = `${sectionName}.${fieldName}`;

  switch (rule.type) {
    case 'string':
      if (typeof value !== 'string') {
        errors.push({ field: path, message: 'Must be a string' });
        return;
      }
      if (rule.maxLength && value.length > rule.maxLength) {
        errors.push({ field: path, message: `Max length ${rule.maxLength}` });
      }
      return;

    case 'number':
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        errors.push({ field: path, message: 'Must be a number' });
        return;
      }
      if (rule.integer && !Number.isInteger(value)) {
        errors.push({ field: path, message: 'Must be an integer' });
      }
      if (rule.min != null && value < rule.min) {
        errors.push({ field: path, message: `Must be at least ${rule.min}` });
      }
      if (rule.max != null && value > rule.max) {
        errors.push({ field: path, message: `Must be at most ${rule.max}` });
      }
      return;

    case 'boolean':
      if (typeof value !== 'boolean') {
        errors.push({ field: path, message: 'Must be boolean' });
      }
      return;

    case 'enum':
      if (!rule.values.includes(value)) {
        errors.push({ field: path, message: `Must be one of: ${rule.values.join(', ')}` });
      }
      return;

    case 'string-array':
      if (!Array.isArray(value)) {
        errors.push({ field: path, message: 'Must be an array' });
        return;
      }
      if (!value.every(v => typeof v === 'string')) {
        errors.push({ field: path, message: 'All items must be strings' });
        return;
      }
      if (rule.values && !value.every(v => rule.values.includes(v))) {
        errors.push({ field: path, message: `Items must be in: ${rule.values.join(', ')}` });
      }
      return;

    case 'date-string':
      if (!isValidDateString(value)) {
        errors.push({ field: path, message: 'Must be YYYY-MM-DD' });
      }
      return;

    default:
      // Unknown rule type, ignore.
  }
};

/**
 * Validate a partial draft. Only checks types/ranges of provided fields.
 * Throws ValidationError if any errors found.
 */
const validateDraft = patch => {
  if (!patch || typeof patch !== 'object') {
    throw new ValidationError('שגיאות בולידציה', [
      { field: 'data', message: 'Must be an object' },
    ]);
  }
  const errors = [];
  SECTION_NAMES.forEach(section => {
    const sectionPatch = patch[section];
    if (sectionPatch == null) return;
    if (typeof sectionPatch !== 'object' || Array.isArray(sectionPatch)) {
      errors.push({ field: section, message: 'Must be an object' });
      return;
    }
    Object.entries(ALL_FIELDS[section]).forEach(([fieldName, rule]) => {
      checkField(section, fieldName, rule, sectionPatch[fieldName], errors);
    });
  });
  if (errors.length) {
    throw new ValidationError('שגיאות בולידציה', errors);
  }
};

/**
 * Validate that the merged profile contains the minimum fields required to
 * complete onboarding. These are the same legacy required-fields the previous
 * controller enforced, plus the new family/asset basics.
 */
const validateComplete = profile => {
  const e = profile.employment || {};
  const p = profile.personal || {};
  const errors = [];

  const requireField = (path, value) => {
    if (value == null) {
      errors.push({ field: path, message: 'Required' });
    }
  };

  // Personal basics
  requireField('personal.age', p.age);
  requireField('personal.maritalStatus', p.maritalStatus);

  // Employment basics (legacy required fields)
  requireField('employment.salaryType', e.salaryType);
  requireField('employment.jobPercentage', e.jobPercentage);
  requireField('employment.isPrimaryJob', e.isPrimaryJob);
  requireField('employment.employmentStartDate', e.employmentStartDate);
  requireField('employment.hasMultipleEmployers', e.hasMultipleEmployers);

  // Conditional salary requirements
  if (e.salaryType === 'global' && e.expectedMonthlyGross == null) {
    errors.push({
      field: 'employment.expectedMonthlyGross',
      message: 'Required for global salaryType',
    });
  }
  if (e.salaryType === 'hourly') {
    if (e.hourlyRate == null) {
      errors.push({ field: 'employment.hourlyRate', message: 'Required for hourly salaryType' });
    }
    if (e.expectedMonthlyHours == null) {
      errors.push({
        field: 'employment.expectedMonthlyHours',
        message: 'Required for hourly salaryType',
      });
    }
  }

  // Retirement basics (legacy required fields)
  const r = profile.retirement || {};
  requireField('retirement.hasPension', r.hasPension);
  requireField('retirement.hasStudyFund', r.hasStudyFund);

  if (errors.length) {
    throw new ValidationError('חסרים פרטים כדי לסיים', errors);
  }
};

/**
 * Accept a legacy flat payload (the old { salaryType, ... } shape sent by
 * older clients) and convert it to the new sectioned shape used by
 * UserProfile.
 */
const normalizeLegacyPatch = patch => {
  if (!patch || typeof patch !== 'object') return patch;

  const looksSectioned = SECTION_NAMES.some(name => name in patch);
  if (looksSectioned) return patch;

  const employmentKeys = [
    'salaryType',
    'expectedMonthlyGross',
    'hourlyRate',
    'expectedMonthlyHours',
    'jobPercentage',
    'isPrimaryJob',
    'hasMultipleEmployers',
    'employmentStartDate',
  ];
  const retirementKeys = ['hasPension', 'hasStudyFund'];

  const sectioned = { employment: {}, retirement: {} };
  Object.entries(patch).forEach(([k, v]) => {
    if (employmentKeys.includes(k)) {
      sectioned.employment[k] = v;
    } else if (retirementKeys.includes(k)) {
      sectioned.retirement[k] = v;
    }
  });
  return sectioned;
};

const mergeProfilePatch = (profile, patch) => {
  SECTION_NAMES.forEach(section => {
    const sectionPatch = patch[section];
    if (sectionPatch == null) return;
    profile[section] = { ...(profile[section]?.toObject?.() ?? profile[section] ?? {}), ...sectionPatch };
  });
};

module.exports = {
  ALL_FIELDS,
  SECTION_NAMES,
  validateDraft,
  validateComplete,
  normalizeLegacyPatch,
  mergeProfilePatch,
  isValidDateString,
};
