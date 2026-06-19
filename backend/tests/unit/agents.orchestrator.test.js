/**
 * Unit tests for the orchestrator agent — intent classification and routing.
 * Specialist agents, the RAG layer and the LLM layer are mocked so routing
 * logic is tested in isolation (no network, no DB).
 */

jest.mock('../../services/agents/payslipAgent', () => ({
  name: 'payslip_analysis',
  description: 'payslip',
  run: jest.fn(),
}));
jest.mock('../../services/agents/pensionAgent', () => ({
  name: 'pension_advisor',
  description: 'pension',
  run: jest.fn(),
}));
jest.mock('../../services/agents/financialAnalysisAgent', () => ({
  name: 'financial_analysis',
  description: 'analysis',
  run: jest.fn(),
}));
jest.mock('../../services/agents/financialPlanningAgent', () => ({
  name: 'financial_planning',
  description: 'planning',
  run: jest.fn(),
}));
jest.mock('../../services/agents/insuranceAgent', () => ({
  name: 'insurance_benefits',
  description: 'insurance',
  run: jest.fn(),
}));
jest.mock('../../services/embeddings/ragService', () => ({ retrieveContext: jest.fn() }));
jest.mock('../../services/agents/baseAgent', () => ({
  getClient: jest.fn(() => null),
  callOllama: jest.fn(),
}));

const { orchestrate, classifyIntent, getAgentList } = require('../../services/agents');
const payslipAgent = require('../../services/agents/payslipAgent');
const pensionAgent = require('../../services/agents/pensionAgent');
const { retrieveContext } = require('../../services/embeddings/ragService');
const { callOllama } = require('../../services/agents/baseAgent');

beforeEach(() => {
  jest.clearAllMocks();
  retrieveContext.mockResolvedValue({ context: '', sources: [] });
});

describe('classifyIntent (rule-based routing)', () => {
  it.each([
    ['הסבר את התלוש שלי', 'payslip_analysis'],
    ['מה המצב עם הפנסיה שלי?', 'pension_advisor'],
    ['האם כדאי לי ביטוח חיים?', 'insurance_benefits'],
    ['עזור לי בתכנון חיסכון', 'financial_planning'],
    ['מהי המגמה בהוצאות שלי?', 'financial_analysis'],
  ])('routes %s → %s', async (query, expected) => {
    await expect(classifyIntent(query)).resolves.toBe(expected);
  });

  it('falls back to "general" when nothing matches and no LLM is available', async () => {
    callOllama.mockResolvedValue(null);
    await expect(classifyIntent('שלום, מה שלומך?')).resolves.toBe('general');
  });
});

describe('getAgentList', () => {
  it('lists all five specialist agents with id/name/description', () => {
    const list = getAgentList();
    expect(list).toHaveLength(5);
    const ids = list.map((a) => a.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        'payslip_analysis',
        'pension_advisor',
        'financial_analysis',
        'financial_planning',
        'insurance_benefits',
      ]),
    );
    list.forEach((a) => {
      expect(typeof a.name).toBe('string');
      expect(typeof a.description).toBe('string');
    });
  });
});

describe('orchestrate (routing to specialists)', () => {
  it('delegates payslip questions to the payslip agent and tags the classification', async () => {
    payslipAgent.run.mockResolvedValue({
      answer: 'הסבר התלוש',
      agent: 'payslip_analysis',
      sources: [],
      model: 'claude',
      tokensUsed: 100,
    });

    const result = await orchestrate('הסבר את התלוש', { userId: 'u1' });
    expect(payslipAgent.run).toHaveBeenCalledWith('הסבר את התלוש', { userId: 'u1' });
    expect(result.classification).toBe('payslip_analysis');
    expect(result.answer).toBe('הסבר התלוש');
  });

  it('delegates pension questions to the pension agent', async () => {
    pensionAgent.run.mockResolvedValue({
      answer: 'מידע פנסיה',
      agent: 'pension_advisor',
      sources: [],
      model: 'claude',
      tokensUsed: 50,
    });

    const result = await orchestrate('כמה מפרישים לפנסיה?', {});
    expect(pensionAgent.run).toHaveBeenCalled();
    expect(result.classification).toBe('pension_advisor');
  });

  it('handles general questions itself via the Ollama fallback', async () => {
    retrieveContext.mockResolvedValue({ context: 'ידע', sources: [{ id: 'k1' }] });
    callOllama
      .mockResolvedValueOnce(null) // classifyIntent → no match → general
      .mockResolvedValueOnce('תשובה כללית'); // general answer

    const result = await orchestrate('ספר לי בדיחה', { userId: 'u1' });
    expect(result.classification).toBe('general');
    expect(result.agent).toBe('orchestrator');
    expect(result.answer).toBe('תשובה כללית');
  });
});
