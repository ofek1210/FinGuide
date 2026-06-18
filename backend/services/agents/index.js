/**
 * Agents module — public API.
 */

const { orchestrate, classifyIntent, getAgentList } = require('./orchestrator');
const payslipAgent = require('./payslipAgent');
const pensionAgent = require('./pensionAgent');
const financialAnalysisAgent = require('./financialAnalysisAgent');
const financialPlanningAgent = require('./financialPlanningAgent');
const insuranceAgent = require('./insuranceAgent');

module.exports = {
  orchestrate,
  classifyIntent,
  getAgentList,
  agents: {
    payslipAgent,
    pensionAgent,
    financialAnalysisAgent,
    financialPlanningAgent,
    insuranceAgent,
  },
};
