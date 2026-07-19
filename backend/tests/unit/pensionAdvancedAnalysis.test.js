'use strict';

const path = require('path');
const fs = require('fs');
const { analyzeFundRanking, analyzePerformanceConsistency } = require('../../services/pensionBenchmarkAdvancedService');
const { analyzeReturnVsRisk } = require('../../services/pensionRiskAnalysisService');
const { analyzeTrackFit } = require('../../services/pensionTrackFitService');
const { analyzeNetReturnAfterFees, analyzeFeeCostUntilRetirement } = require('../../services/pensionFeeAnalysisService');
const { analyzeCoverage, hasSurvivorCoverage } = require('../../services/pensionCoverageAnalysisService');
const { analyzeInactiveFunds } = require('../../services/pensionInactiveFundAnalysisService');
const { buildPensionInsight } = require('../../utils/pensionInsightBuilder');
const { percentileRank, median } = require('../../utils/pensionStats');
const { formatPensiaRow } = require('../../services/pensionMarketDataService');
const { loadPensionUserContext } = require('../../services/pensionUserProfileService');

const PEERS = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../fixtures/pension-advanced/pensianet-peers.json'), 'utf8'),
);
const PROFILE = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../fixtures/pension-advanced/user-profile.json'), 'utf8'),
);

const SAMPLE_FUND = {
  _id: 'fund-001',
  fundName: 'מיטב מקיפה כללי',
  fundType: 'pension_comprehensive',
  provider: 'מיטב',
  investmentTrack: 'כללי',
  riskLevel: 'medium',
  currentBalance: 350000,
  monthlyDeposit: 2500,
  managementFeeAccumulation: 0.55,
  managementFeeDeposit: 1.5,
  historicalReturn5Y: 6.2,
  historicalReturn1Y: 7.5,
  isActive: true,
  insuranceCoverages: [{ coverageType: 'קצבת שארים', monthlyPension: 1500 }],
};

const MATCH = formatPensiaRow(PEERS.find(p => p.ID === 'user-match-001'));
const PEER_GROUP = {
  groupKey: 'pension_comprehensive:medium:cohort',
  peers: PEERS.filter(p => p.ID.startsWith('peer')).map(formatPensiaRow),
  size: 5,
};

const USER_CONTEXT = {
  personal: PROFILE.personal,
  retirement: { plannedRetirementAge: 67, yearsToRetirement: 29 },
  financial: PROFILE.financial,
  employment: PROFILE.employment,
  risk: { effective: 'medium', fromOnboarding: 'medium' },
};

const CTX = {
  fundId: 'fund-001',
  userContext: USER_CONTEXT,
  match: MATCH,
  peerGroup: PEER_GROUP,
  matchConfidence: 0.8,
};

describe('pensionStats', () => {
  it('percentileRank returns 0-100', () => {
    expect(percentileRank(5, [1, 2, 3, 4, 5, 6])).toBeGreaterThan(0);
    expect(median([1, 2, 3, 4, 5])).toBe(3);
  });
});

describe('pensionInsightBuilder', () => {
  it('builds unified schema with disclaimer', () => {
    const ins = buildPensionInsight({
      category: 'test',
      title: 'כותרת',
      finding: 'ממצא',
      recommendedAction: 'פעולה',
    });
    expect(ins.category).toBe('test');
    expect(ins.disclaimer).toBeTruthy();
    expect(ins.legacy.type).toBe('test');
  });
});

describe('pensionBenchmarkAdvancedService', () => {
  it('analyzeFundRanking produces percentile narrative', () => {
    const insights = analyzeFundRanking(SAMPLE_FUND, CTX);
    expect(insights.length).toBeGreaterThan(0);
    expect(insights[0].finding).toMatch(/אחוזון/);
    expect(insights[0].benchmark.group).toBe(PEER_GROUP.groupKey);
  });

  it('analyzePerformanceConsistency detects mixed performance', () => {
    const insights = analyzePerformanceConsistency(SAMPLE_FUND, CTX);
    expect(insights.length).toBe(1);
    expect(insights[0].category).toBe('performance_consistency');
  });

  it('analyzePerformanceConsistency uses compounded 12M track data when available', () => {
    const ctxWithTrack = {
      ...CTX,
      trackPerformance: {
        trackId: 'user-match-001',
        compounded: {
          return12M: { compoundedReturnPct: 8.5, complete: true, monthsUsed: 12 },
          return36M: { compoundedReturnPct: 22.1, complete: true, monthsUsed: 36 },
          return60M: { compoundedReturnPct: null, complete: false },
        },
        peerBenchmark: {
          median12M: 6.2,
          median36M: 18.0,
          percentile12M: 72,
          percentile36M: 65,
          peerCount12M: 5,
        },
        monthlyConsistency: {
          monthsCompared: 12,
          monthsAboveMedian: 8,
          monthsBelowMedian: 4,
          aboveMedianRate: 67,
          trend: 'stable',
        },
      },
    };
    const insights = analyzePerformanceConsistency(SAMPLE_FUND, ctxWithTrack);
    expect(insights.length).toBe(1);
    expect(insights[0].finding).toMatch(/תשואה מצטברת 12 חודשים/);
    expect(insights[0].finding).toMatch(/אחוזון 72/);
    expect(insights[0].benchmark.compounded12M).toBe(8.5);
    expect(insights[0].benchmark.percentile).toBe(72);
  });

  it('analyzeFundRanking prefers compounded 12M percentile when available', () => {
    const ctxWithTrack = {
      ...CTX,
      trackPerformance: {
        compounded: {
          return12M: { compoundedReturnPct: 5.1, complete: true },
        },
        peerBenchmark: { percentile12M: 25, median12M: 7.0, peerCount12M: 5 },
      },
    };
    const insights = analyzeFundRanking(SAMPLE_FUND, ctxWithTrack);
    expect(insights[0].finding).toMatch(/תשואה מצטברת 12 חודשים/);
    expect(insights[0].benchmark.compounded12MPercentile).toBe(25);
    expect(insights[0].severity).toBe('medium');
  });
});

describe('pensionRiskAnalysisService', () => {
  it('analyzeReturnVsRisk flags high risk low sharpe', () => {
    const insights = analyzeReturnVsRisk(SAMPLE_FUND, CTX);
    expect(insights.length).toBe(1);
    expect(insights[0].limitations).toContain('אין נתוני אלפא — לא בוצע חישוב אלפא');
  });
});

describe('pensionTrackFitService', () => {
  it('returns empty when risk matches', () => {
    expect(analyzeTrackFit(SAMPLE_FUND, CTX)).toEqual([]);
  });

  it('flags risk mismatch', () => {
    const highFund = { ...SAMPLE_FUND, riskLevel: 'high', investmentTrack: 'מניות' };
    const ctx = { ...CTX, userContext: { ...USER_CONTEXT, risk: { effective: 'low' } } };
    const insights = analyzeTrackFit(highFund, ctx);
    expect(insights.length).toBe(1);
    expect(insights[0].recommendedAction).toMatch(/בעל רישיון/);
  });
});

describe('pensionFeeAnalysisService', () => {
  it('analyzeNetReturnAfterFees includes net estimate disclaimer', () => {
    const insights = analyzeNetReturnAfterFees(SAMPLE_FUND, CTX);
    expect(insights[0].limitations.some(l => l.includes('הערכה'))).toBe(true);
  });

  it('analyzeFeeCostUntilRetirement projects impact', () => {
    const insights = analyzeFeeCostUntilRetirement(SAMPLE_FUND, CTX);
    expect(insights[0].estimatedImpact.retirement).toBeGreaterThan(0);
  });
});

describe('pensionCoverageAnalysisService', () => {
  it('detects survivor coverage for single user', () => {
    expect(hasSurvivorCoverage(SAMPLE_FUND.insuranceCoverages)).toBe(true);
    const insights = analyzeCoverage([SAMPLE_FUND], USER_CONTEXT);
    expect(insights.some(i => i.category === 'survivor_coverage_fit')).toBe(true);
    expect(insights.find(i => i.category === 'survivor_coverage_fit').requiresLicensedAdvisor).toBe(true);
  });
});

describe('pensionInactiveFundAnalysisService', () => {
  it('flags inactive fund without auto-consolidate language', () => {
    const inactive = {
      ...SAMPLE_FUND,
      _id: 'fund-002',
      isActive: false,
      monthlyDeposit: 0,
      currentBalance: 3000,
      managementFeeAccumulation: 0.8,
    };
    const insights = analyzeInactiveFunds([SAMPLE_FUND, inactive], USER_CONTEXT);
    expect(insights.some(i => i.category === 'inactive_fund')).toBe(true);
    expect(insights[0].recommendedAction).toMatch(/לפני איחוד/);
  });
});

describe('loadPensionUserContext', () => {
  it('merges summary age with profile fields', async () => {
    const UserProfile = require('../../models/UserProfile');
    jest.spyOn(UserProfile, 'findOne').mockReturnValue({
      lean: () => Promise.resolve({ personal: PROFILE.personal, retirement: PROFILE.retirement, financial: PROFILE.financial, employment: PROFILE.employment }),
    });
    const ctx = await loadPensionUserContext('user-1', { currentAge: 38, retirementAge: 67 });
    expect(ctx.personal.maritalStatus).toBe('single');
    expect(ctx.retirement.yearsToRetirement).toBe(29);
    UserProfile.findOne.mockRestore();
  });
});
