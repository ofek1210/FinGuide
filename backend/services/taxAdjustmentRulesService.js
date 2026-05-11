const DEFAULT_TAX_BRACKETS = [
  { limit: 84120, rate: 0.1 },
  { limit: 120720, rate: 0.14 },
  { limit: 193800, rate: 0.2 },
  { limit: 269280, rate: 0.31 },
  { limit: 560280, rate: 0.35 },
  { limit: 721560, rate: 0.47 },
  { limit: Number.POSITIVE_INFINITY, rate: 0.5 },
];

const DEFAULT_ANNUAL_CREDIT_POINT_VALUE = 3384;
const DEFAULT_CREDIT_POINTS = 2.25;

function roundMoney(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

function progressiveTax(annualIncome, brackets = DEFAULT_TAX_BRACKETS) {
  if (!Number.isFinite(annualIncome) || annualIncome <= 0) {
    return 0;
  }

  let taxableLeft = annualIncome;
  let lower = 0;
  let total = 0;

  for (const bracket of brackets) {
    if (taxableLeft <= 0) break;
    const slice = Math.min(taxableLeft, bracket.limit - lower);
    if (slice > 0) {
      total += slice * bracket.rate;
      taxableLeft -= slice;
    }
    lower = bracket.limit;
  }

  return roundMoney(total);
}

function calculateAnnualTaxAdjustment({
  year,
  grossTotal,
  taxPaidTotal,
  monthsPresent = [],
  missingMonths = [],
  taxCreditPointsAverage,
  taxBrackets = DEFAULT_TAX_BRACKETS,
  annualCreditPointValue = DEFAULT_ANNUAL_CREDIT_POINT_VALUE,
} = {}) {
  const monthsCovered = Array.isArray(monthsPresent) ? monthsPresent.length : 0;
  const hasEnoughData = Number.isFinite(grossTotal) && grossTotal > 0;
  if (!hasEnoughData) {
    return {
      year,
      status: 'insufficient_data',
      expectedAnnualTax: 0,
      actualTaxWithheld: roundMoney(taxPaidTotal || 0),
      estimatedRefundOrDue: 0,
      confidence: 0,
      assumptions: ['Missing reliable annual gross total.'],
      calculationBreakdown: {},
    };
  }

  const points = Number.isFinite(taxCreditPointsAverage) && taxCreditPointsAverage >= 0
    ? taxCreditPointsAverage
    : DEFAULT_CREDIT_POINTS;

  const baseTax = progressiveTax(grossTotal, taxBrackets);
  const creditsAmount = roundMoney(points * annualCreditPointValue);
  const expectedAnnualTax = roundMoney(Math.max(0, baseTax - creditsAmount));
  const actualTaxWithheld = roundMoney(taxPaidTotal || 0);
  const estimatedRefundOrDue = roundMoney(actualTaxWithheld - expectedAnnualTax);
  const isPartial = Array.isArray(missingMonths) && missingMonths.length > 0;

  const coverageRatio = Math.max(0, Math.min(1, monthsCovered / 12));
  const confidence = roundMoney(
    Math.max(0, Math.min(1, (isPartial ? 0.25 : 0.45) + (coverageRatio * 0.55))),
  );

  const assumptions = [
    'Annual income is approximated from uploaded payslips in the selected year.',
    `Tax credit points assumed as ${points} (average from payslips or default).`,
    'Tax brackets are configured constants and can be updated yearly.',
  ];

  if (isPartial) {
    assumptions.push('Year coverage is partial; estimate quality is reduced.');
  }

  return {
    year,
    status: isPartial ? 'partial' : 'complete',
    expectedAnnualTax,
    actualTaxWithheld,
    estimatedRefundOrDue,
    confidence,
    assumptions,
    calculationBreakdown: {
      annualGross: roundMoney(grossTotal),
      baseTaxBeforeCredits: baseTax,
      annualCreditPoints: points,
      annualCreditAmount: creditsAmount,
      monthsCovered,
      missingMonths,
    },
  };
}

module.exports = {
  DEFAULT_ANNUAL_CREDIT_POINT_VALUE,
  DEFAULT_CREDIT_POINTS,
  DEFAULT_TAX_BRACKETS,
  calculateAnnualTaxAdjustment,
  progressiveTax,
};
