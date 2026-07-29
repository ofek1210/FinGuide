/**
 * Insurance health score — driven by deterministic Insurance Decision Engine.
 */

const {
  buildInsuranceDecision,
  decisionToHealthCheck,
} = require('./insurance/insuranceDecisionEngine');

/**
 * @param {object} profileDTO
 * @param {object} analysis
 * @param {object} [marketAdvice]
 */
function runInsuranceHealthCheck(profileDTO, analysis, marketAdvice = {}) {
  const decision = buildInsuranceDecision(profileDTO, analysis, marketAdvice, {
    policies: analysis.policies || analysis.aggregatedPolicies || profileDTO.policies,
  });
  return decisionToHealthCheck(decision, analysis);
}

module.exports = { runInsuranceHealthCheck };
