const readIntEnv = (key, fallback) => {
  const raw = process.env[key];
  if (raw == null || raw === '') {
    return fallback;
  }
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback;
};

const readBoolEnv = (key, fallback) => {
  const raw = process.env[key];
  if (raw == null || raw === '') {
    return fallback;
  }
  return ['1', 'true', 'yes', 'on'].includes(String(raw).toLowerCase());
};

const getDepositContinuityConfig = () => ({
  minMonthsWithDeposit: readIntEnv('DEPOSIT_CONTINUITY_MIN_MONTHS_WITH_DEPOSIT', 2),
  minGapMonths: readIntEnv('DEPOSIT_CONTINUITY_MIN_GAP_MONTHS', 1),
  missingPayslipGapWarningMonths: readIntEnv('DEPOSIT_CONTINUITY_MISSING_PAYSLIP_WARNING_MONTHS', 2),
  lookbackMonths: readIntEnv('DEPOSIT_CONTINUITY_LOOKBACK_MONTHS', 36),
  countSeveranceAsDeposit: readBoolEnv('DEPOSIT_CONTINUITY_COUNT_SEVERANCE_AS_DEPOSIT', true),
  uncertainMonthsThreshold: readIntEnv('DEPOSIT_CONTINUITY_UNCERTAIN_MONTHS_THRESHOLD', 2),
  suppressNoDepositWhenBreak: readBoolEnv('DEPOSIT_CONTINUITY_SUPPRESS_NO_DEPOSIT_WHEN_BREAK', true),
});

const DISCLAIMER_HE =
  'בדיקה השוואתית בלבד — אינה ייעוץ משפטי או דוח תאימות.';

module.exports = {
  getDepositContinuityConfig,
  DISCLAIMER_HE,
};
