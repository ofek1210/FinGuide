/**
 * Unit tests for ai/services/parallelAnalysisService.
 * The orchestrator agent is mocked; this tests input validation, focus
 * sanitization, and the sanitized response shape.
 */

jest.mock('../../ai/agents/orchestratorAgent', () => ({ runFullAnalysis: jest.fn() }));

const { runFullAnalysis } = require('../../ai/agents/orchestratorAgent');
const { runParallelAnalysis } = require('../../ai/services/parallelAnalysisService');

beforeEach(() => {
  jest.clearAllMocks();
});

function fakeAnalysis() {
  return {
    runId: 'run_1',
    summary: 'סיכום',
    summarySource: 'rule',
    recommendations: [{ type: 'pension_low' }],
    canvas: { focus: 'all', summaryHe: '2 תלושים' },
    govData: { ready: true, pension: { trackCount: 10 }, insurance: { providerCount: 5 } },
    globalScore: { year: 2026, score: 72, level: 'good', label: 'טוב' },
    actionItems: [{ priority: 'high', title: 'פעולה', domain: 'pension' }],
    agents: {
      payslip: {
        status: 'success',
        message: null,
        data: { payslipCount: 2 },
        recommendations: [{ type: 'pension_low' }],
        durationMs: 12,
        llmExplanation: 'הסבר',
      },
    },
    meta: { ran: ['payslip'] },
  };
}

describe('runParallelAnalysis', () => {
  it('throws when no userId is provided', async () => {
    await expect(runParallelAnalysis()).rejects.toThrow('userId is required');
  });

  it('passes a valid focus straight through to the orchestrator', async () => {
    runFullAnalysis.mockResolvedValue(fakeAnalysis());
    await runParallelAnalysis('user-1', { focus: 'pension', skipLLM: true, refreshGovData: true });
    expect(runFullAnalysis).toHaveBeenCalledWith('user-1', {
      skipLLM: true,
      focus: 'pension',
      refreshGovData: true,
    });
  });

  it('falls back to "all" for an invalid focus value', async () => {
    runFullAnalysis.mockResolvedValue(fakeAnalysis());
    await runParallelAnalysis('user-1', { focus: 'bogus' });
    expect(runFullAnalysis).toHaveBeenCalledWith('user-1', { skipLLM: false, focus: 'all', refreshGovData: false });
  });

  it('sanitizes the orchestrator result into a stable DTO', async () => {
    runFullAnalysis.mockResolvedValue(fakeAnalysis());
    const result = await runParallelAnalysis('user-1', {});

    expect(result.success).toBe(true);
    expect(result.runId).toBe('run_1');
    expect(result.summary).toBe('סיכום');
    expect(result.agents.payslip).toEqual({
      status: 'success',
      message: null,
      data: { payslipCount: 2 },
      recommendationCount: 1,
      durationMs: 12,
      explanation: 'הסבר',
    });
    expect(result.canvas?.summaryHe).toBe('2 תלושים');
    expect(result.globalScore?.score).toBe(72);
    expect(result.actionItems).toHaveLength(1);
  });

  it('coerces a non-string userId via toString()', async () => {
    runFullAnalysis.mockResolvedValue(fakeAnalysis());
    await runParallelAnalysis({ toString: () => 'oid-123' }, {});
    expect(runFullAnalysis).toHaveBeenCalledWith('oid-123', { skipLLM: false, focus: 'all', refreshGovData: false });
  });
});
