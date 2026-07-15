/**
 * Unit tests for ai/agents/gemelAgent — the analysis pipeline is mocked
 * so the agent contract (status, data shaping, LLM gating) is tested in isolation.
 */

jest.mock('../../services/gemelAnalysisService', () => ({
  buildGemelAnalysis: jest.fn(),
}));
jest.mock('../../services/claudeChatService', () => ({
  askClaude: jest.fn(),
}));

const { buildGemelAnalysis } = require('../../services/gemelAnalysisService');
const { askClaude } = require('../../services/claudeChatService');
const { runGemelAgent } = require('../../ai/agents/gemelAgent');

const RICH_ANALYSIS = {
  summary: {
    hasData: true,
    grossSalary: 18000,
    studyFundEmployee: 450,
    studyFundEmployer: 1350,
    totalMonthlyContribution: 1800,
    totalBalance: 95000,
    studyFundBalance: 95000,
    providentBalance: 0,
    fundCount: 1,
    studyFundCount: 1,
    providentFundCount: 0,
    hasStudyFund: true,
    hasProvidentFund: false,
    declaredStudyFund: true,
    currentMgmtFee: 0.8,
    salaryAboveCeiling: true,
    annualTaxFreeDeposit: 20520,
  },
  marketAdvice: {
    hasData: true,
    overallVerdict: 'NEGOTIATE',
    overallVerdictLabelHe: 'נהל משא ומתן',
    dataSource: 'gemelnet_db',
    sourceName: 'גמל-נט (data.gov.il)',
    funds: [{
      productName: 'קרן א',
      companyName: 'חברה',
      verdict: 'NEGOTIATE',
      verdictLabelHe: 'נהל משא ומתן',
      returnPercentile: 49,
      userFee: 0.8,
      marketFee: 0.69,
      annualSavingsEstimate: 120,
      alternatives: [],
      summaryHe: 'סיכום',
    }],
  },
  payslipFindings: [
    { id: 'study_fund_no_deposit', title: 'כותרת', severity: 'warning', details: 'פרטים', meta: null },
  ],
  recommendations: [{ type: 'gemel_market_negotiate', title: 'א', reason: 'ב', urgency: 'medium' }],
  profile: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.ANTHROPIC_API_KEY;
});

describe('runGemelAgent', () => {
  it('returns no_data with a Hebrew message when there is nothing to analyze', async () => {
    buildGemelAnalysis.mockResolvedValue({
      summary: { hasData: false },
      marketAdvice: { hasData: false },
      payslipFindings: [],
      recommendations: [],
    });

    const result = await runGemelAgent('user-1', { skipLLM: true });
    expect(result.agentId).toBe('gemel');
    expect(result.status).toBe('no_data');
    expect(result.data).toBeNull();
    expect(result.recommendations).toEqual([]);
    expect(result.message).toContain('לא נמצאו');
  });

  it('returns the standard success contract with shaped data', async () => {
    buildGemelAnalysis.mockResolvedValue(RICH_ANALYSIS);

    const result = await runGemelAgent('user-1', { skipLLM: true });
    expect(result.status).toBe('success');
    expect(result.data.marketAdvice.overallVerdict).toBe('NEGOTIATE');
    expect(result.data.marketAdvice.funds[0]).toMatchObject({
      productName: 'קרן א',
      verdict: 'NEGOTIATE',
      returnPercentile: 49,
    });
    expect(result.data.payslipFindings).toHaveLength(1);
    expect(result.recommendations).toHaveLength(1);
    expect(typeof result.durationMs).toBe('number');
  });

  it('skips the LLM when skipLLM is true even with an API key', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    buildGemelAnalysis.mockResolvedValue(RICH_ANALYSIS);

    const result = await runGemelAgent('user-1', { skipLLM: true });
    expect(askClaude).not.toHaveBeenCalled();
    expect(result.llmExplanation).toBeNull();
  });

  it('attaches the LLM explanation when available, and survives LLM failure', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    buildGemelAnalysis.mockResolvedValue(RICH_ANALYSIS);

    askClaude.mockResolvedValueOnce({ answer: 'הסבר' });
    let result = await runGemelAgent('user-1');
    expect(result.llmExplanation).toBe('הסבר');

    askClaude.mockRejectedValueOnce(new Error('boom'));
    result = await runGemelAgent('user-1');
    expect(result.status).toBe('success');
    expect(result.llmExplanation).toBeNull();
  });
});
