/**
 * Configurable assumptions for pension advanced analysis.
 * Do not hard-code financial assumptions in service logic — read from here.
 */

module.exports = {
  /** Default annual gross return assumption for fee-projection math (decimal, e.g. 0.06 = 6%) */
  defaultAnnualReturnAssumption: Number(process.env.PENSION_PROJECTION_ANNUAL_RETURN) || 0.06,

  /** Small inactive fund balance threshold (ILS) — indicator only, not auto-consolidate */
  smallInactiveBalanceThreshold: Number(process.env.PENSION_SMALL_INACTIVE_THRESHOLD) || 5000,

  /** Minimum months of deposit history required for contribution continuity checks */
  minDepositHistoryMonths: 3,

  /** Drop in monthly deposit vs rolling avg that triggers a flag (fraction) */
  depositDropThreshold: 0.25,

  /** Minimum peer group size for benchmark comparisons */
  minPeerGroupSize: 5,

  /** Percentile buckets for narrative labels */
  percentileLabels: {
    top: 75,
    aboveMedian: 50,
    belowMedian: 25,
  },

  /** Standard disclaimer appended to personal pension insights */
  licensedAdvisorDisclaimer:
    'המידע אינו מהווה ייעוץ פנסיוני או המלצה לביצוע פעולה. יש להתייעץ עם בעל רישיון לפני שינוי מסלול, איחוד קרנות או שינוי כיסוי ביטוחי.',

  /** Net-return estimate disclaimer */
  netReturnDisclaimer:
    'תשואה נטו משוערת — חישוב הערכה בלבד, לא תשואה חשבונאית מדויקת.',

  /** Survivor coverage keywords in clearinghouse insurance sheet */
  survivorCoverageTypes: [
    'שארים',
    'אלמן',
    'אלמנה',
    'יתום',
    'יתומים',
    'survivor',
    'widow',
  ],

  /** Disability coverage keywords */
  disabilityCoverageTypes: [
    'נכות',
    'אובדן כושר',
    'disability',
  ],
};
