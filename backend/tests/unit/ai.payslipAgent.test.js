/**
 * Unit tests for ai/agents/payslipAgent (runPayslipAgent).
 * The tools layer and Claude are mocked so the agent's orchestration logic
 * is tested without DB or network access.
 */

jest.mock('../../ai/tools/payslipTools');
jest.mock('../../services/claudeChatService', () => ({ askClaude: jest.fn() }));

const tools = require('../../ai/tools/payslipTools');
const { askClaude } = require('../../services/claudeChatService');
const { runPayslipAgent } = require('../../ai/agents/payslipAgent');

const originalEnv = process.env;

beforeEach(() => {
  jest.clearAllMocks();
  process.env = { ...originalEnv };
});

afterAll(() => {
  process.env = originalEnv;
});

describe('runPayslipAgent', () => {
  it('returns a no_data status when the user has no payslips', async () => {
    tools.getPayslipSummaries.mockResolvedValue({ count: 0, payslips: [], latestPeriod: null });

    const result = await runPayslipAgent('user-1', { skipLLM: true });
    expect(result.status).toBe('no_data');
    expect(result.recommendations).toEqual([]);
    expect(tools.analyzeSalary).not.toHaveBeenCalled();
  });

  it('runs the full pipeline and returns structured data (skipLLM)', async () => {
    tools.getPayslipSummaries.mockResolvedValue({
      count: 2,
      latestPeriod: '3/2025',
      payslips: [{ grossSalary: 21000, netSalary: 14500 }, { grossSalary: 20000, netSalary: 14000 }],
    });
    tools.analyzeSalary.mockReturnValue({
      trend: { direction: 'up' },
      anomalies: { hasAnomalies: false, anomalies: [] },
      latestGross: 21000,
      latestNet: 14500,
    });
    tools.generatePayslipRecommendations.mockReturnValue([{ type: 'pension_low' }]);

    const result = await runPayslipAgent('user-1', { skipLLM: true });

    expect(result.status).toBe('success');
    expect(result.data.payslipCount).toBe(2);
    expect(result.data.latestGross).toBe(21000);
    expect(result.recommendations).toHaveLength(1);
    expect(result.llmExplanation).toBeNull();
    expect(askClaude).not.toHaveBeenCalled();
  });

  it('adds an LLM explanation when a key is set and skipLLM is false', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    tools.getPayslipSummaries.mockResolvedValue({
      count: 1,
      latestPeriod: '3/2025',
      payslips: [{ grossSalary: 20000, netSalary: 14000 }],
    });
    tools.analyzeSalary.mockReturnValue({
      trend: null,
      anomalies: { hasAnomalies: false, anomalies: [] },
      latestGross: 20000,
      latestNet: 14000,
    });
    tools.generatePayslipRecommendations.mockReturnValue([]);
    askClaude.mockResolvedValue({ answer: 'ניתוח קצר של התלוש.' });

    const result = await runPayslipAgent('user-1', { skipLLM: false });
    expect(askClaude).toHaveBeenCalled();
    expect(result.llmExplanation).toBe('ניתוח קצר של התלוש.');
  });

  it('stays successful even if the LLM call throws (non-fatal)', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    tools.getPayslipSummaries.mockResolvedValue({
      count: 1,
      latestPeriod: '3/2025',
      payslips: [{ grossSalary: 20000, netSalary: 14000 }],
    });
    tools.analyzeSalary.mockReturnValue({
      trend: null,
      anomalies: { hasAnomalies: false, anomalies: [] },
      latestGross: 20000,
      latestNet: 14000,
    });
    tools.generatePayslipRecommendations.mockReturnValue([]);
    askClaude.mockRejectedValue(new Error('claude down'));

    const result = await runPayslipAgent('user-1', { skipLLM: false });
    expect(result.status).toBe('success');
    expect(result.llmExplanation).toBeNull();
  });
});
