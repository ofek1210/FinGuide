'use strict';

const { calculateMgmtFeeSavings } = require('../ai/engines/calculationEngine');
const config = require('../config/pensionAnalysisConfig');

/**
 * Projection helpers — fee impact until retirement (shared by fee analysis).
 */
function projectFeeImpact({
  balance,
  monthlyContribution,
  yearsRemaining,
  currentFee,
  targetFee,
}) {
  if (yearsRemaining == null || currentFee == null || balance == null) {
    return { savingsByRetirement: null, additionalMonthlyPension: null };
  }
  return calculateMgmtFeeSavings(
    balance,
    monthlyContribution || 0,
    yearsRemaining,
    currentFee,
    targetFee ?? currentFee,
  );
}

function getProjectionAssumptions() {
  return {
    annualReturn: config.defaultAnnualReturnAssumption,
    disclaimer: config.licensedAdvisorDisclaimer,
  };
}

module.exports = { projectFeeImpact, getProjectionAssumptions };
