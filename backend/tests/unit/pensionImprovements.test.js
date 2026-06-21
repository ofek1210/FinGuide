'use strict';

const path = require('path');
const fs = require('fs');
const { parseHarHaKesefExcel, parseHarHaKesefText } = require('../../services/harHaKesefService');
const { parseQuarterlyReportText } = require('../../services/pensionQuarterlyReportService');
const { fundMergeKey, mergeFundRecord } = require('../../services/pensionFundMergeService');
const { generatePensionRecommendations } = require('../../ai/tools/pensionTools');
const { buildPensionBenchmarkFindings } = require('../../utils/detectPensionBenchmark');
const { recommendationsToInsights } = require('../../utils/pensionRecommendationMapper');

const FIXTURE_DIR = path.join(__dirname, '../fixtures/har-hakesef');
const expected = JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, 'expected.json'), 'utf8'));

describe('pensionAnalysisService', () => {
  it.skip('buildPensionAnalysis returns benchmark and healthCheck shape (covered by pension.upload integration)', () => {});
});

describe('pensionFundMergeService', () => {
  it('fundMergeKey prefers account number', () => {
    const key = fundMergeKey({ provider: 'מגדל', accountNumber: 'ACC-001', fundName: 'מגדל מקיפה' });
    expect(key).toContain('acc');
  });

  it('mergeFundRecord enriches quarterly track', () => {
    const merged = mergeFundRecord(
      { source: 'har_hakesef', fundName: 'מגדל', investmentTrack: null, managementFeeAccumulation: 0.006 },
      { investmentTrack: 'מניות', managementFeeAccumulation: 0.0055, fundName: 'מגדל' },
      'quarterly_report',
    );
    expect(merged.investmentTrack).toBe('מניות');
    expect(merged.managementFeeAccumulation).toBe(0.0055);
  });
});

describe('generatePensionRecommendations dedupe', () => {
  it('returns unique titles and sorts high-impact first', () => {
    const summary = {
      hasData: true,
      hasMissingPension: true,
      fundCount: 4,
      hasStudyFund: false,
      parseWarnings: [],
      grossSalary: 20000,
      expectedMinEmployee: 1200,
      expectedMinEmployer: 1300,
      currentAccumulation: 500000,
      totalMonthlyContribution: 4000,
      currentMgmtFee: 0.006,
      currentAge: 35,
      retirementAge: 67,
      funds: [{ fundName: 'מגדל', status: 'active', riskLevel: 'low' }],
    };
    const projection = {
      available: true,
      contributionRules: { belowMinimum: false },
      mgmtFeeSavings: { additionalMonthlyPension: 500, savingsByRetirement: 80000 },
      replacementRatio: 45,
    };
    const benchmark = {
      funds: [{
        fundName: 'מגדל',
        feeVsMarket: 'above_market',
        potentialSavingsToRetirement: 120000,
        rankLabel: 'below_average',
        riskMismatch: true,
        riskLevel: 'low',
        recommendedRiskLevel: 'high',
        userFee: 0.006,
        marketAvgFee: 0.0035,
        matchConfidence: 80,
        matchedTrack: { name: 'מגדל מקיפה' },
        marketRankPercentile: 30,
      }],
      summary: { fundsAboveMarketFee: 1 },
    };

    const recs = generatePensionRecommendations(summary, projection, { benchmark });
    const titles = recs.map(r => r.title);
    expect(new Set(titles).size).toBe(titles.length);
    expect(titles[0]).toMatch(/דמי ניהול|לא זוהו|ריבוי/);
  });
});

describe('detectPensionBenchmark from recommendations', () => {
  it('maps fee and risk recommendations to findings', () => {
    const analysis = {
      summary: { hasData: true, currentAge: 35 },
      healthCheck: { score: 40, level: { label: 'דורש טיפול' } },
      recommendations: [
        {
          type: 'fee_above_market',
          title: 'דמי ניהול מעל השוק — מגדל',
          reason: 'test',
          urgency: 'high',
          financialImpact: '₪50,000',
        },
        {
          type: 'risk_wrong_for_age',
          title: 'מסלול סיכון לא מתאים לגיל — מגדל',
          reason: 'test',
          urgency: 'medium',
        },
        {
          type: 'multiple_funds',
          title: 'ריבוי קרנות',
          reason: 'ignored',
          urgency: 'low',
        },
      ],
    };

    const findings = buildPensionBenchmarkFindings(analysis);
    expect(findings.some(f => f.meta.findingKind === 'pension_health_low')).toBe(true);
    expect(findings.some(f => f.meta.findingKind === 'fee_above_market')).toBe(true);
    expect(findings.some(f => f.meta.findingKind === 'risk_wrong_for_age')).toBe(true);
    expect(findings.some(f => f.title === 'ריבוי קרנות')).toBe(false);
  });

  it('maps track_underperforming to findings', () => {
    const analysis = {
      summary: { hasData: true, currentAge: 40 },
      healthCheck: { score: 60, level: { label: 'טוב' } },
      recommendations: [
        {
          type: 'track_underperforming',
          title: 'מסלול מתחת לממוצע — מגדל',
          reason: 'test',
          urgency: 'medium',
        },
      ],
    };
    const findings = buildPensionBenchmarkFindings(analysis);
    expect(findings.some(f => f.meta.findingKind === 'track_underperforming')).toBe(true);
  });
});

describe('recommendationsToInsights', () => {
  it('maps urgency to severity', () => {
    const insights = recommendationsToInsights([
      { type: 'fee_above_market', title: 'test', reason: 'r', urgency: 'high', financialImpact: '₪1' },
    ]);
    expect(insights[0].severity).toBe('warning');
    expect(insights[0].category).toBe('pension');
  });
});

describe('parser regression expected.json', () => {
  it('parseHarHaKesefExcel matches expected summary', () => {
    const result = parseHarHaKesefExcel(path.join(FIXTURE_DIR, 'sample-report.xlsx'));
    expect(result.source).toBe(expected.excel.source);
    expect(result.exportDate).toBe(expected.excel.exportDate);
    expect(result.funds).toHaveLength(expected.excel.fundCount);
    expect(result.summary.totalBalance).toBe(expected.excel.totalBalance);

    const pension = result.funds.find(f => f.fundType === 'pension_comprehensive');
    expect(pension.fundName).toBe(expected.excel.sampleFund.fundName);
    expect(pension.managementFeeAccumulation).toBe(expected.excel.sampleFund.managementFeeAccumulation);
  });

  it('parseQuarterlyReportText matches expected quarterly fixture', () => {
    const text = fs.readFileSync(path.join(FIXTURE_DIR, 'sample-quarterly-report.txt'), 'utf8');
    const result = parseQuarterlyReportText(text);
    expect(result.source).toBe(expected.quarterlyText.source);
    expect(result.funds.length).toBeGreaterThanOrEqual(expected.quarterlyText.minFunds);
    expect(result.funds[0].provider).toBe(expected.quarterlyText.provider);
    expect(result.funds[0].currentBalance).toBe(expected.quarterlyText.balance);
  });
});
