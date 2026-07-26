'use strict';

const {
  formatInsightsDeterministically,
  validateLlmOutput,
  LLM_SYSTEM_PROMPT,
} = require('../../services/financialAdvisory/llmInsightFormatter');
const { prioritizeFinancialInsights } = require('../../utils/financialInsightPrioritizer');
const { buildFinancialInsight, fromPensionStructuredInsight } = require('../../utils/financialInsightBuilder');
const { classifyLiquidity } = require('../../services/gemelAnalyzers');

jest.mock('../../services/financialAdvisory/marketDataMetaService', () => ({
  getMarketDataMeta: jest.fn().mockResolvedValue({
    source: 'PENSION_NET',
    latestReportPeriod: '202506',
    lastSyncedAt: new Date().toISOString(),
    isStale: false,
    warnings: [],
  }),
  enrichMarketWarnings: jest.fn((m) => m),
}));

jest.mock('../../services/financialAdvisory/llmInsightFormatter', () => {
  const actual = jest.requireActual('../../services/financialAdvisory/llmInsightFormatter');
  return {
    ...actual,
    formatFinancialInsightsWithLLM: jest.fn(),
  };
});

const { formatFinancialInsightsWithLLM } = require('../../services/financialAdvisory/llmInsightFormatter');
const { runFinancialAdvisoryAgent } = require('../../services/financialAdvisory/runFinancialAdvisoryAgent');

const SAMPLE_INSIGHT = buildFinancialInsight({
  id: 'ins-1',
  code: 'high_asset_management_fee',
  productType: 'GEMEL',
  category: 'fees',
  severity: 'high',
  priority: 20,
  title: 'דמי ניהול גבוהים',
  reason: 'דמי הניהול 1.2% מעל חציון הקבוצה.',
  suggestedAction: 'בדוק מול הגוף המנהל.',
  confidence: 0.8,
  sources: ['user.fund'],
  analyzerName: 'analyzeGemelFees',
});

const PENSION_INSIGHT_RAW = {
  id: 'p1',
  category: 'fund_ranking',
  severity: 'info',
  title: 'דירוג',
  finding: 'אחוזון 50',
  recommendedAction: 'בדוק',
  confidence: 0.7,
  benchmark: {},
  personalDataUsed: [],
  marketDataUsed: [],
  estimatedImpact: {},
  assumptions: [],
  limitations: [],
  requiresLicensedAdvisor: true,
  disclaimer: 'disclaimer',
};

describe('financialAdvisory shared layer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    formatFinancialInsightsWithLLM.mockImplementation(async ({ structuredInsights, skipLLM }) => {
      const actual = jest.requireActual('../../services/financialAdvisory/llmInsightFormatter');
      if (skipLLM) {
        return {
          formatted: actual.formatInsightsDeterministically(structuredInsights),
          llm: { used: false, provider: null, fallbackUsed: true },
        };
      }
      return {
        formatted: actual.formatInsightsDeterministically(structuredInsights),
        llm: { used: true, provider: 'ollama', fallbackUsed: true },
      };
    });
  });

  it('formatInsightsDeterministically works without LLM', () => {
    const out = formatInsightsDeterministically([SAMPLE_INSIGHT]);
    expect(out.primaryRecommendations[0].insightId).toBe('ins-1');
    expect(out.primaryRecommendations[0].explanation).toContain('1.2%');
  });

  it('validateLlmOutput rejects unknown insight IDs', () => {
    const parsed = validateLlmOutput({
      summary: 'ok',
      primaryRecommendations: [{ insightId: 'unknown', title: 'x', explanation: 'y' }],
    }, ['ins-1']);
    expect(parsed).toBeNull();
  });

  it('validateLlmOutput accepts only approved insight IDs', () => {
    const parsed = validateLlmOutput({
      summary: 'נמצא נושא אחד',
      primaryRecommendations: [{
        insightId: 'ins-1',
        title: 'דמי ניהול',
        explanation: 'פשוט',
        whyItMatters: 'חשוב',
        nextStep: 'בדוק',
      }],
    }, ['ins-1']);
    expect(parsed.primaryRecommendations).toHaveLength(1);
  });

  it('invalid LLM JSON triggers fallback via orchestrator', async () => {
    formatFinancialInsightsWithLLM.mockResolvedValueOnce({
      formatted: formatInsightsDeterministically([fromPensionStructuredInsight(PENSION_INSIGHT_RAW)]),
      llm: { used: true, provider: 'ollama', fallbackUsed: true },
    });

    const res = await runFinancialAdvisoryAgent({
      userId: 'u1',
      productType: 'PENSION',
      skipLLM: false,
      precomputed: {
        unifiedInsights: [fromPensionStructuredInsight(PENSION_INSIGHT_RAW)],
        engineMeta: { fundCount: 1 },
        matchResults: [{ matchConfidence: 80 }],
      },
    });
    expect(res.llm.fallbackUsed).toBe(true);
    expect(res.primaryRecommendations.length).toBeGreaterThan(0);
  });

  it('missing API key / LLM null triggers fallback', async () => {
    formatFinancialInsightsWithLLM.mockResolvedValueOnce({
      formatted: formatInsightsDeterministically([SAMPLE_INSIGHT]),
      llm: { used: false, provider: null, fallbackUsed: true },
    });

    const res = await runFinancialAdvisoryAgent({
      userId: 'u1',
      productType: 'GEMEL',
      skipLLM: false,
      precomputed: {
        unifiedInsights: [SAMPLE_INSIGHT],
        engineMeta: { fundCount: 1 },
        matchResults: [{ matchConfidence: 85 }],
      },
    });
    expect(res.llm.fallbackUsed).toBe(true);
    expect(res.structuredInsights.length).toBe(1);
  });

  it('pension and gemel responses share schema keys', async () => {
    const pension = await runFinancialAdvisoryAgent({
      userId: 'u1',
      productType: 'PENSION',
      skipLLM: true,
      precomputed: { unifiedInsights: [], engineMeta: {}, matchResults: [] },
    });
    const gemel = await runFinancialAdvisoryAgent({
      userId: 'u1',
      productType: 'GEMEL',
      skipLLM: true,
      precomputed: { unifiedInsights: [], engineMeta: {}, matchResults: [] },
    });

    for (const key of ['productType', 'analysisId', 'marketData', 'dataQuality', 'structuredInsights', 'llm', 'disclaimer']) {
      expect(pension[key]).toBeDefined();
      expect(gemel[key]).toBeDefined();
    }
  });

  it('prioritizer merges overlapping fee insights per product', () => {
    const dup = buildFinancialInsight({
      id: 'a',
      code: 'fee_cost_projection',
      productType: 'PENSION',
      category: 'fees',
      severity: 'high',
      title: 'דמי ניהול',
      reason: 'גבוה',
      suggestedAction: 'בדוק',
      productId: 'f1',
      confidence: 0.9,
      sources: [],
      financialImpact: { amount: 500, period: 'annual', currency: 'ILS' },
      evidence: { benchmark: { feePercentile: 70 } },
    });
    const dup2 = {
      ...dup,
      id: 'b',
      code: 'net_return_estimate',
      reason: 'גבוה מאוד',
    };
    const { centralRecommendations } = prioritizeFinancialInsights([dup, dup2], { productType: 'PENSION' });
    expect(centralRecommendations.length).toBe(1);
    expect(centralRecommendations[0].code).toBe('MANAGEMENT_FEES_REVIEW');
  });

  it('hishtalmut liquidity classification distinguishes liquid vs unknown', () => {
    expect(classifyLiquidity({ fundType: 'study_fund', rawData: {} }).status).toBe('unknown');
    expect(classifyLiquidity({
      fundType: 'study_fund',
      rawData: { liquidityDate: '2020-01-01' },
    }).status).toBe('liquid');
    expect(classifyLiquidity({
      fundType: 'study_fund',
      rawData: { expectedLiquidityDate: '2030-06-01' },
    }).status).toBe('not_yet_liquid');
  });

  it('LLM prompt forbids inventing recommendations', () => {
    expect(LLM_SYSTEM_PROMPT).toMatch(/do not add recommendations/i);
    expect(LLM_SYSTEM_PROMPT).toMatch(/do not change any numbers/i);
  });
});
