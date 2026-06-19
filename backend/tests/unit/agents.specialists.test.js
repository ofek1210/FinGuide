/**
 * Unit tests for the specialist agents. Verifies each agent's identity
 * (name / description / ragCategory) and its domain-specific user-context
 * formatting. The LLM and RAG layers are not exercised here (covered by
 * agents.baseAgent.test.js).
 */

const payslipAgent = require('../../services/agents/payslipAgent');
const pensionAgent = require('../../services/agents/pensionAgent');
const financialAnalysisAgent = require('../../services/agents/financialAnalysisAgent');
const financialPlanningAgent = require('../../services/agents/financialPlanningAgent');
const insuranceAgent = require('../../services/agents/insuranceAgent');

describe('specialist agent identities', () => {
  it.each([
    [payslipAgent, 'payslip_analysis', 'payslip'],
    [pensionAgent, 'pension_advisor', 'pension'],
    [financialAnalysisAgent, 'financial_analysis', 'tax'],
    [financialPlanningAgent, 'financial_planning', 'planning'],
    [insuranceAgent, 'insurance_benefits', 'insurance'],
  ])('%# exposes the expected name and rag category', (agent, name, ragCategory) => {
    expect(agent.name).toBe(name);
    expect(typeof agent.description).toBe('string');
    expect(agent.description.length).toBeGreaterThan(0);
    expect(agent.ragCategory).toBe(ragCategory);
    expect(typeof agent.systemPrompt).toBe('string');
    expect(typeof agent.run).toBe('function');
  });
});

describe('payslipAgent.formatUserContext', () => {
  it('renders salary, deductions and pension sections from context', () => {
    const text = payslipAgent.formatUserContext({
      payslipDate: '2025-03',
      employeeName: 'דנה',
      grossSalary: 20000,
      netSalary: 14000,
      tax: 2500,
      pensionEmployee: 1200,
      salaryComponents: [{ type: 'בונוס', amount: 1000 }],
    });
    expect(text).toContain('דנה');
    expect(text).toContain('20000');
    expect(text).toContain('בונוס');
    expect(text).toContain('פנסיה עובד');
  });

  it('handles missing context gracefully', () => {
    expect(payslipAgent.formatUserContext(null)).toContain('אין נתוני תלוש');
  });

  it('lists previous-month history when present', () => {
    const text = payslipAgent.formatUserContext({
      grossSalary: 20000,
      payslipHistory: [{ date: '2025-02', grossSalary: 19000, netSalary: 13000 }],
    });
    expect(text).toContain('חודשים קודמים');
    expect(text).toContain('19000');
  });
});

describe('every specialist builds a full prompt with the study disclaimer', () => {
  it.each([
    payslipAgent,
    pensionAgent,
    financialAnalysisAgent,
    financialPlanningAgent,
    insuranceAgent,
  ])('%# includes the disclaimer in buildFullPrompt', (agent) => {
    const prompt = agent.buildFullPrompt({ grossSalary: 1000 }, 'context');
    expect(prompt).toContain('ייעוץ פיננסי מקצועי');
  });
});
