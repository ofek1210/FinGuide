/**
 * Calculation Engine
 *
 * Layer 2 of the Hybrid AI stack.
 * Deterministic financial calculations — no LLM.
 * Produces numbers that the LLM layer can safely reference.
 *
 * IMPORTANT: Every function returns plain DTO objects.
 * Never expose Mongoose documents here.
 */



// ── Constants (Israel 2026) ───────────────────────────────────────────────────

const PENSION_DEFAULTS = {
  annualReturnRate: 0.055,       // 5.5% real return
  inflationRate: 0.025,          // 2.5% inflation
  avgMgmtFeeAccumulation: 0.003, // 0.3% of accumulation
  avgMgmtFeeDeposit: 0.001,      // 0.1% of deposit
  replacementRate: 0.70,         // target: 70% of last salary
};

// ── Pension projections ───────────────────────────────────────────────────────

/**
 * Project monthly pension income at retirement.
 *
 * @param {object} params
 * @param {number} params.currentAge
 * @param {number} params.retirementAge - default 67
 * @param {number} params.currentAccumulation - existing balance in NIS
 * @param {number} params.monthlyContribution - total monthly (employer + employee)
 * @param {number} [params.annualReturnRate] - override default
 * @param {number} [params.mgmtFeeAccumulation] - override default
 * @returns {{
 *   monthsToRetirement: number,
 *   projectedAccumulation: number,
 *   monthlyPensionEstimate: number,
 *   replacementRate: number,
 *   scenarios: { base: object, optimistic: object }
 * }}
 */
function projectPensionIncome({
  currentAge,
  retirementAge = 67,
  currentAccumulation = 0,
  monthlyContribution = 0,
  annualReturnRate = PENSION_DEFAULTS.annualReturnRate,
  mgmtFeeAccumulation = PENSION_DEFAULTS.avgMgmtFeeAccumulation,
}) {
  const monthsToRetirement = Math.max(0, (retirementAge - currentAge) * 12);
  const monthlyRate = (annualReturnRate - mgmtFeeAccumulation) / 12;

  // Future value of existing accumulation
  const fvExisting = currentAccumulation * (1 + monthlyRate)**monthsToRetirement;

  // Future value of monthly contributions (annuity)
  const fvContributions =
    monthlyRate > 0
      ? monthlyContribution * (((1 + monthlyRate)**monthsToRetirement - 1) / monthlyRate)
      : monthlyContribution * monthsToRetirement;

  const projectedAccumulation = Math.round(fvExisting + fvContributions);

  // Monthly pension using 240-month (20 year) drawdown
  const DRAWDOWN_MONTHS = 240;
  const drawdownRate = monthlyRate;
  const monthlyPension =
    drawdownRate > 0
      ? (projectedAccumulation * drawdownRate) / (1 - (1 + drawdownRate)**-DRAWDOWN_MONTHS)
      : projectedAccumulation / DRAWDOWN_MONTHS;

  // Optimistic scenario: 7% return, low fees
  const optimisticRate = (0.07 - 0.002) / 12;
  const fvOptAccum = currentAccumulation * (1 + optimisticRate)**monthsToRetirement;
  const fvOptContrib =
    optimisticRate > 0
      ? monthlyContribution * (((1 + optimisticRate)**monthsToRetirement - 1) / optimisticRate)
      : monthlyContribution * monthsToRetirement;
  const optimisticAccumulation = Math.round(fvOptAccum + fvOptContrib);
  const optimisticPension =
    optimisticRate > 0
      ? (optimisticAccumulation * optimisticRate) / (1 - (1 + optimisticRate)**-DRAWDOWN_MONTHS)
      : optimisticAccumulation / DRAWDOWN_MONTHS;

  return {
    monthsToRetirement,
    projectedAccumulation,
    monthlyPensionEstimate: Math.round(monthlyPension),
    scenarios: {
      base: {
        label: 'בסיסי (תשואה 5.5%, דמי ניהול 0.3%)',
        accumulation: projectedAccumulation,
        monthlyPension: Math.round(monthlyPension),
      },
      optimistic: {
        label: 'אופטימיסטי (תשואה 7%, דמי ניהול 0.2%)',
        accumulation: optimisticAccumulation,
        monthlyPension: Math.round(optimisticPension),
      },
    },
  };
}

/**
 * Calculate management fee impact over time.
 * @param {number} accumulation
 * @param {number} monthlyContribution
 * @param {number} yearsRemaining
 * @param {number} currentFee - current annual fee as decimal (e.g. 0.008)
 * @param {number} targetFee  - target annual fee (e.g. 0.002)
 * @returns {{ savingsByRetirement: number, additionalMonthlyPension: number }}
 */
function calculateMgmtFeeSavings(accumulation, monthlyContribution, yearsRemaining, currentFee, targetFee) {
  const months = yearsRemaining * 12;
  const currentRate = (PENSION_DEFAULTS.annualReturnRate - currentFee) / 12;
  const targetRate  = (PENSION_DEFAULTS.annualReturnRate - targetFee)  / 12;

  const fvCurrent =
    accumulation * (1 + currentRate)**months +
    monthlyContribution * (((1 + currentRate)**months - 1) / Math.max(currentRate, 1e-8));

  const fvTarget =
    accumulation * (1 + targetRate)**months +
    monthlyContribution * (((1 + targetRate)**months - 1) / Math.max(targetRate, 1e-8));

  const savings = Math.round(fvTarget - fvCurrent);
  const DRAWDOWN_MONTHS = 240;
  const additionalPension = Math.round(savings / DRAWDOWN_MONTHS);

  return { savingsByRetirement: savings, additionalMonthlyPension: additionalPension };
}

// ── Salary trend calculations ─────────────────────────────────────────────────

/**
 * Calculate month-over-month salary trend.
 * @param {Array<{ grossSalary: number, period: string }>} payslips - sorted newest first
 * @returns {{ trend: 'up' | 'down' | 'stable', changePct: number, changeAmount: number }}
 */
function calculateSalaryTrend(payslips) {
  if (!Array.isArray(payslips) || payslips.length < 2) {
    return { trend: 'stable', changePct: 0, changeAmount: 0 };
  }

  const latest = payslips[0]?.grossSalary;
  const previous = payslips[1]?.grossSalary;

  if (!latest || !previous || previous === 0) {
    return { trend: 'stable', changePct: 0, changeAmount: 0 };
  }

  const changeAmount = latest - previous;
  const changePct = parseFloat(((changeAmount / previous) * 100).toFixed(2));
  const trend = changePct > 1 ? 'up' : changePct < -1 ? 'down' : 'stable';

  return { trend, changePct, changeAmount };
}

// ── Financial health score ────────────────────────────────────────────────────

/**
 * Quick lightweight score (for orchestrator — not full financialHealthScoreService).
 * @param {object} params
 * @param {number} params.payslipCount
 * @param {boolean} params.hasPension
 * @param {boolean} params.hasInsurance
 * @param {number} params.pensionRate - decimal (employee contribution / gross)
 * @param {boolean} params.hasAnomalies
 * @returns {{ score: number, level: string, label: string }}
 */
function calculateQuickHealthScore({ payslipCount, hasPension, hasInsurance, pensionRate, hasAnomalies }) {
  let score = 0;
  if (payslipCount >= 3) score += 25;
  else if (payslipCount >= 1) score += 15;

  if (hasPension) score += 25;
  if (pensionRate >= 0.06) score += 15;
  if (hasInsurance) score += 20;
  if (!hasAnomalies) score += 15;

  const level =
    score >= 85 ? 'excellent'
    : score >= 70 ? 'good'
    : score >= 50 ? 'fair'
    : 'poor';

  const label =
    level === 'excellent' ? 'מצב פיננסי מצוין'
    : level === 'good' ? 'מצב פיננסי טוב'
    : level === 'fair' ? 'יש מקום לשיפור'
    : 'דורש טיפול';

  return { score, level, label };
}

// ── Insurance savings estimation ──────────────────────────────────────────────

/**
 * Estimate potential monthly insurance savings.
 * @param {object[]} duplicates - from ruleEngine.runInsuranceDuplicateRules
 * @returns { monthlyEstimate: number, annualEstimate: number }
 */
function estimateInsuranceSavings(duplicates) {
  const monthlyEstimate = (duplicates || []).reduce(
    (sum, d) => sum + (d.estimatedMonthlyWaste || 0),
    0,
  );
  return {
    monthlyEstimate: Math.round(monthlyEstimate),
    annualEstimate: Math.round(monthlyEstimate * 12),
  };
}

module.exports = {
  projectPensionIncome,
  calculateMgmtFeeSavings,
  calculateSalaryTrend,
  calculateQuickHealthScore,
  estimateInsuranceSavings,
  PENSION_DEFAULTS,
};
