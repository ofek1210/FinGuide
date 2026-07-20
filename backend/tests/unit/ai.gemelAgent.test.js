/**
 * Unit tests for ai/agents/gemelAgent — analysis pipeline mocked.
 */

jest.mock('../../services/gemelAnalysisService', () => ({
  buildGemelAnalysis: jest.fn(),
}));

const { buildGemelAnalysis } = require('../../services/gemelAnalysisService');
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
  structuredInsights: [],
  primaryRecommendations: [],
  llm: { used: false, provider: null, fallbackUsed: true },
  profile: null,
};

beforeEach(() => {
  jest.clearAllMocks();
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
    expect(result.data.payslipFindings).toHaveLength(1);
    expect(result.recommendations).toHaveLength(1);
    expect(typeof result.durationMs).toBe('number');
  });

  it('uses shared LLM formatter output from buildGemelAnalysis', async () => {
    buildGemelAnalysis.mockResolvedValue({
      ...RICH_ANALYSIS,
      llm: { used: true, provider: 'ollama', fallbackUsed: false, summary: 'נמצאו שני נושאים.' },
      primaryRecommendations: [{
        insightId: 'ins-1',
        title: 'דמי ניהול',
        explanation: 'גבוהים מהחציון',
        whyItMatters: 'משפיע לאורך זמן',
        nextStep: 'בדוק מול הגוף המנהל',
      }],
    });

    const result = await runGemelAgent('user-1', { skipLLM: false });
    expect(result.llm.used).toBe(true);
    expect(result.llmExplanation).toBe('נמצאו שני נושאים.');
    expect(result.primaryRecommendations[0].insightId).toBe('ins-1');
  });

  it('falls back when LLM not used', async () => {
    buildGemelAnalysis.mockResolvedValue({
      ...RICH_ANALYSIS,
      primaryRecommendations: [{
        insightId: 'ins-1',
        title: 'דמי ניהול',
        explanation: 'גבוהים',
        whyItMatters: 'חשוב',
        nextStep: 'בדוק',
      }],
    });

    const result = await runGemelAgent('user-1', { skipLLM: true });
    expect(result.llm.fallbackUsed).toBe(true);
    expect(result.llmExplanation).toContain('גבוהים');
  });
});
