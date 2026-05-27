const readPercentEnv = (key, fallback) => {
  const raw = process.env[key];
  if (raw == null || raw === '') {
    return fallback;
  }
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
};

const readToleranceEnv = (key, fallback) => {
  const raw = process.env[key];
  if (raw == null || raw === '') {
    return fallback;
  }
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
};

const readBoolEnv = (key, fallback) => {
  const raw = process.env[key];
  if (raw == null || raw === '') {
    return fallback;
  }
  return ['1', 'true', 'yes', 'on'].includes(String(raw).toLowerCase());
};

/**
 * Reference minimum contribution rates (percent) for comparative findings only.
 * Not legal advice — override via environment variables when needed.
 */
const getContributionRateThresholds = () => ({
  inconsistencyTolerancePercent: readToleranceEnv('CONTRIBUTION_RATE_INCONSISTENCY_TOLERANCE', 0.35),
  adjustForJobPercent: readBoolEnv('DEPOSIT_RATE_ADJUST_FOR_JOB_PERCENT', false),
  pension: {
    employeeMinPercent: readPercentEnv('PENSION_EMPLOYEE_MIN_RATE_PERCENT', 6.0),
    employerMinPercent: readPercentEnv('PENSION_EMPLOYER_MIN_RATE_PERCENT', 6.5),
    severanceMinPercent: readPercentEnv('PENSION_SEVERANCE_MIN_RATE_PERCENT', 6.0),
  },
  study_fund: {
    employeeMinPercent: readPercentEnv('STUDY_FUND_EMPLOYEE_MIN_RATE_PERCENT', 2.5),
    employerMinPercent: readPercentEnv('STUDY_FUND_EMPLOYER_MIN_RATE_PERCENT', 7.5),
  },
});

const DISCLAIMER_HE =
  'בדיקה השוואתית בלבד — אינה ייעוץ משפטי או דוח תאימות.';

module.exports = {
  getContributionRateThresholds,
  DISCLAIMER_HE,
};
