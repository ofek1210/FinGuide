/**
 * Agents module — public API.
 */

const { orchestrate, classifyIntent, getAgentList } = require('./orchestrator');
const payslipAgent = require('./payslipAgent');
const pensionAgent = require('./pensionAgent');
const gemelAgent = require('./gemelAgent');
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
    gemelAgent,
    financialAnalysisAgent,
    financialPlanningAgent,
    insuranceAgent,
  },
};
