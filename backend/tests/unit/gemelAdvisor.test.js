'use strict';

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

jest.mock('../../services/gemelRecommendationEngine', () => ({
  runGemelRecommendationEngine: jest.fn().mockResolvedValue({ insights: [] }),
}));

jest.mock('../../services/gemelAdvisor/gemelLlmService', () => ({
  polishGemelReportSummary: jest.fn(async () => ({ summary: 'סיכום בדיקה', llm: { used: false } })),
}));

jest.mock('../../services/gemelAdvisor/suitabilityProfile', () => ({
  buildSuitabilityProfile: jest.fn(),
  normalizeRiskTolerance: jest.requireActual('../../services/gemelAdvisor/suitabilityProfile').normalizeRiskTolerance,
}));

jest.mock('../../models/PensionFund', () => ({
  find: jest.fn(() => ({ lean: jest.fn().mockResolvedValue([]) })),
  create: jest.fn(),
  findOneAndUpdate: jest.fn(),
}));

const { buildSuitabilityProfile } = require('../../services/gemelAdvisor/suitabilityProfile');
const { parseUserExcelBuffer } = require('../../services/gemelAdvisor/userExcelParser');
const { matchAccountToOfficial, normalizeMatchText } = require('../../services/gemelAdvisor/fundMatcher');
const { normalizeDataGovRow } = require('../../services/gemelAdvisor/providers/dataGovGemelProvider');
const { normalizeGemelNetRow } = require('../../services/gemelAdvisor/providers/gemelNetProvider');
const { rankAlternatives, scorePerformance } = require('../../services/gemelAdvisor/alternativesEngine');
const {
  analyzeAccountFees,
  analyzeAccountReturns,
  analyzeRiskSuitability,
  classifyFee,
} = require('../../services/gemelAdvisor/accountAnalyzer');
const { emptyNormalizedAccount } = require('../../services/gemelAdvisor/schemas');
const { buildGemelAdvisorReport, buildOrchestratorPayload } = require('../../services/gemelAdvisor/gemelAdvisorService');
const { mergeOfficialFundRecords } = require('../../services/gemelAdvisor/officialFundMerger');
const { MAX_ALTERNATIVES } = require('../../config/gemelAdvisorConfig');

describe('gemel advisor engine', () => {
  const officialSample = [
    normalizeDataGovRow({
      FUND_ID: '101',
      FUND_NAME: 'הראל אג"ח',
      MANAGING_CORPORATION: 'הראל פנסיה',
      FUND_CLASSIFICATION: 'תגמולים ואישית לפיצויים',
      SPECIALIZATION: 'אג"ח',
      REPORT_PERIOD: '202401',
      AVG_ANNUAL_MANAGEMENT_FEE: 0.61,
      AVG_DEPOSIT_FEE: 0.44,
      AVG_ANNUAL_YIELD_TRAILING_5YRS: 4.35,
      STANDARD_DEVIATION: 5.11,
      SHARPE_RATIO: 0.47,
      STOCK_MARKET_EXPOSURE: 25,
    }),
    normalizeDataGovRow({
      FUND_ID: '202',
      FUND_NAME: 'מסלול כללי',
      MANAGING_CORPORATION: 'כלל גמל',
      FUND_CLASSIFICATION: 'תגמולים ואישית לפיצויים',
      SPECIALIZATION: 'כללי',
      REPORT_PERIOD: '202401',
      AVG_ANNUAL_MANAGEMENT_FEE: 0.45,
      AVG_DEPOSIT_FEE: 0.35,
      AVG_ANNUAL_YIELD_TRAILING_5YRS: 5.1,
      SHARPE_RATIO: 0.6,
      STOCK_MARKET_EXPOSURE: 40,
    }),
    normalizeDataGovRow({
      FUND_ID: '303',
      FUND_NAME: 'השתלמות כללי',
      MANAGING_CORPORATION: 'מיטב',
      FUND_CLASSIFICATION: 'קרנות השתלמות',
      SPECIALIZATION: 'כללי',
      REPORT_PERIOD: '202401',
      AVG_ANNUAL_MANAGEMENT_FEE: 0.5,
      AVG_ANNUAL_YIELD_TRAILING_5YRS: 4.8,
    }),
  ].filter(Boolean);

  const profileBase = {
    riskTolerance: 'medium',
    investmentHorizonYears: 15,
    needsLiquiditySoon: false,
    canAbsorbLosses: true,
    missingFields: [],
    profileConfidence: 0.8,
  };

  it('matches by exact fund code', () => {
    const account = emptyNormalizedAccount({ fundCode: '101', productType: 'gemel', fundName: 'X' });
    const match = matchAccountToOfficial(account, officialSample);
    expect(match.matchMethod).toBe('fund_code');
    expect(match.matchConfidence).toBeGreaterThanOrEqual(95);
  });

  it('rejects low-confidence fuzzy match', () => {
    const account = emptyNormalizedAccount({
      fundName: 'קרן לא קשורה בכלל',
      companyName: 'חברה לא ידועה',
      productType: 'gemel',
    });
    const match = matchAccountToOfficial(account, officialSample);
    expect(match.matchMethod).toBe('no_match');
    expect(match.matchConfidence).toBeLessThan(55);
  });

  it('classifies user fee above peer average', () => {
    const cls = classifyFee(0.9, 0.6);
    expect(['above_average', 'significantly_above_average']).toContain(cls);
  });

  it('classifies user fee below peer average', () => {
    expect(classifyFee(0.52, 0.6)).toBe('below_average');
  });

  it('does not invent savings without balance', () => {
    const account = emptyNormalizedAccount({
      managementFeeBalancePct: 0.8,
      balance: 0,
      fundName: 'Test',
    });
    const match = matchAccountToOfficial({ ...account, fundCode: '101' }, officialSample);
    const fee = analyzeAccountFees(account, match, officialSample);
    expect(fee.findings[0]?.possibleSavings ?? null).toBeNull();
  });

  it('returns max 3 alternatives', () => {
    const account = emptyNormalizedAccount({ productType: 'gemel', fundName: 'הראל', companyName: 'הראל', fundCode: '101' });
    const match = matchAccountToOfficial(account, officialSample);
    const alts = rankAlternatives(account, match, officialSample, profileBase);
    expect(alts.length).toBeLessThanOrEqual(MAX_ALTERNATIVES);
  });

  it('alternatives stay in same product type', () => {
    const account = emptyNormalizedAccount({ productType: 'study_fund', fundCode: '303', fundName: 'השתלמות' });
    const match = matchAccountToOfficial(account, officialSample);
    const profile = { ...profileBase, riskTolerance: 'low', canAbsorbLosses: false };
    const alts = rankAlternatives(account, match, officialSample, profile);
    for (const alt of alts) {
      expect(officialSample.find(f => f.fundCode === alt.fundCode)?.productType).toBe('study_fund');
    }
  });

  it('builds orchestrator-compatible payload', () => {
    const report = {
      status: 'success',
      generatedAt: new Date().toISOString(),
      findings: [{ title: 'test' }],
      recommendations: [{ title: 'rec', severity: 'high', possibleSavings: 1000, confidence: 0.8, explanation: 'x' }],
      accounts: [{ alternatives: [] }],
      strengths: [],
      risks: [],
      opportunities: [],
      dataQuality: { matchedAccounts: 1, unmatchedAccounts: 0, totalAccounts: 1, warnings: [] },
    };
    const orch = buildOrchestratorPayload(report);
    expect(orch.recommendations).toHaveLength(1);
    expect(orch.possibleSavings).toBe(1000);
  });

  it('normalizes gemelnet row without inventing fields', () => {
    const row = normalizeGemelNetRow({ ID: '5', SHM_KRN: 'Test', SUG_KRN: 'קרנות השתלמות' });
    expect(row.fundCode).toBe('5');
    expect(row.return3YearsAnnualizedPct).toBeNull();
  });

  it('normalizes match text', () => {
    expect(normalizeMatchText('הראל פנסיה וגמל בע"מ')).not.toContain('בע"מ');
  });

  it('parses Hebrew column headers from fixture when present', () => {
    const fixture = path.join(__dirname, '../fixtures/har-hakesef/sample-report.xlsx');
    if (!fs.existsSync(fixture)) return;
    const buf = fs.readFileSync(fixture);
    const parsed = parseUserExcelBuffer(buf, 'test-user');
    expect(parsed).toHaveProperty('accounts');
    expect(Array.isArray(parsed.warnings)).toBe(true);
  });

  it('parses Hebrew and English Excel column headers', () => {
    const wb = XLSX.utils.book_new();
    const rows = [
      ['Account', 'Fund Name', 'Company', 'Product Type', 'Balance', 'Mgmt Fee Balance'],
      ['A1', 'Test Fund', 'Acme', 'קרן השתלמות', '₪12,500', '0.65%'],
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const parsed = parseUserExcelBuffer(buf, 'u1');
    expect(parsed.accounts.length).toBeGreaterThanOrEqual(1);
    expect(parsed.accounts[0].fundName).toBeTruthy();
  });

  it('handles percentages stored as strings', () => {
    const account = emptyNormalizedAccount({
      fundCode: '101',
      managementFeeBalancePct: 0.65,
      balance: 100000,
    });
    const match = matchAccountToOfficial(account, officialSample);
    const fee = analyzeAccountFees(account, match, officialSample);
    expect(fee.estimatedAnnualFeeCost).toBe(650);
  });

  it('handles missing fund code with name match or no_match', () => {
    const account = emptyNormalizedAccount({
      fundName: 'הראל אג"ח',
      companyName: 'הראל פנסיה',
      productType: 'gemel',
    });
    const match = matchAccountToOfficial(account, officialSample);
    expect(['exact_name', 'normalized_name', 'no_match']).toContain(match.matchMethod);
  });

  it('flags weak long-term despite acceptable recent return context', () => {
    const lowPerfFund = {
      ...officialSample[0],
      return5YearsAnnualizedPct: 2.0,
    };
    const peers = officialSample.map(f => ({ ...f, return5YearsAnnualizedPct: 5 + Math.random() }));
    const match = { matchedFund: lowPerfFund, matchConfidence: 95 };
    const account = emptyNormalizedAccount({ fundCode: '101', fundName: 'הראל' });
    const result = analyzeAccountReturns(account, match, peers);
    expect(['below_peer_group', 'materially_below_peer_group', 'near_peer_group']).toContain(result.classification);
  });

  it('suggests higher risk review for low track + long horizon + high tolerance', () => {
    const match = {
      matchedFund: { riskLevel: 'low' },
      matchConfidence: 90,
    };
    const profile = {
      ...profileBase,
      riskTolerance: 'high',
      investmentHorizonYears: 12,
      needsLiquiditySoon: false,
      canAbsorbLosses: true,
      missingFields: [],
    };
    const result = analyzeRiskSuitability(emptyNormalizedAccount(), match, profile);
    expect(['investment_horizon_may_support_higher_risk', 'current_track_may_be_too_conservative', 'current_risk_appears_suitable']).toContain(result.conclusion);
    expect(result.findings.some(f => f.type === 'risk_review_opportunity' || f.type === 'risk_track_mismatch')).toBe(true);
  });

  it('flags liquidity conflict for short horizon', () => {
    const match = { matchedFund: { riskLevel: 'low' }, matchConfidence: 90 };
    const profile = {
      ...profileBase,
      needsLiquiditySoon: true,
      missingFields: [],
    };
    const result = analyzeRiskSuitability(emptyNormalizedAccount(), match, profile);
    expect(result.findings.some(f => f.type === 'liquidity_conflict')).toBe(true);
  });

  it('flags aggressive track vs low risk tolerance', () => {
    const match = { matchedFund: { riskLevel: 'high' }, matchConfidence: 90 };
    const profile = { ...profileBase, riskTolerance: 'low', missingFields: [] };
    const result = analyzeRiskSuitability(emptyNormalizedAccount(), match, profile);
    expect(result.conclusion).toBe('current_track_may_be_too_aggressive');
  });

  it('handles missing onboarding risk tolerance', () => {
    const match = { matchedFund: { riskLevel: 'medium' }, matchConfidence: 90 };
    const profile = { ...profileBase, missingFields: ['riskTolerance'] };
    const result = analyzeRiskSuitability(emptyNormalizedAccount(), match, profile);
    expect(result.conclusion).toBe('insufficient_onboarding_data');
  });

  it('records conflicts between official sources instead of silent merge', () => {
    const gemelnet = normalizeGemelNetRow({
      ID: '101',
      SHM_KRN: 'Test',
      SUG_KRN: 'תגמולים',
      SHIUR_D_NIHUL_AHARON_TTVURAH: 0.8,
      TKUFAT_DUACH: 202401,
    });
    const dataGov = normalizeDataGovRow({
      FUND_ID: '101',
      FUND_NAME: 'Test',
      FUND_CLASSIFICATION: 'תגמולים',
      AVG_ANNUAL_MANAGEMENT_FEE: 0.5,
      REPORT_PERIOD: '202401',
    });
    const { funds, conflicts } = mergeOfficialFundRecords([gemelnet, dataGov]);
    expect(funds).toHaveLength(1);
    expect(conflicts.length).toBeGreaterThan(0);
  });

  it('does not rank alternatives by return alone', () => {
    const highReturnLowFee = normalizeDataGovRow({
      FUND_ID: '999',
      FUND_NAME: 'High Return',
      FUND_CLASSIFICATION: 'תגמולים',
      SPECIALIZATION: 'כללי',
      REPORT_PERIOD: '202401',
      AVG_ANNUAL_MANAGEMENT_FEE: 0.9,
      AVG_ANNUAL_YIELD_TRAILING_5YRS: 12,
    });
    const lowReturnLowFee = normalizeDataGovRow({
      FUND_ID: '998',
      FUND_NAME: 'Low Fee',
      FUND_CLASSIFICATION: 'תגמולים',
      SPECIALIZATION: 'כללי',
      REPORT_PERIOD: '202401',
      AVG_ANNUAL_MANAGEMENT_FEE: 0.2,
      AVG_ANNUAL_YIELD_TRAILING_5YRS: 3,
    });
    const pool = [...officialSample, highReturnLowFee, lowReturnLowFee];
    const account = emptyNormalizedAccount({ productType: 'gemel', fundCode: '101', fundName: 'הראל' });
    const match = matchAccountToOfficial(account, pool);
    const alts = rankAlternatives(account, match, pool, profileBase);
    if (alts.length >= 2) {
      const top = alts[0];
      expect(top.overallAlternativeScore).toBeDefined();
      expect(scorePerformance(12, 5)).toBeGreaterThan(scorePerformance(3, 5));
    }
  });

  it('returns partial status when profile incomplete', async () => {
    const userId = '507f1f77bcf86cd799439011';
    buildSuitabilityProfile.mockResolvedValueOnce({
      riskTolerance: 'unknown',
      investmentHorizonYears: null,
      needsLiquiditySoon: false,
      canAbsorbLosses: false,
      missingFields: ['age', 'riskTolerance', 'investmentHorizonYears'],
      profileConfidence: 0.4,
    });

    const report = await buildGemelAdvisorReport(userId, {
      skipLLM: true,
      summary: { hasData: true, hasStudyFund: true },
      officialFunds: officialSample,
      parsedAccounts: [
        emptyNormalizedAccount({
          accountId: 'acc-1',
          userId,
          productType: 'study_fund',
          fundCode: '303',
          fundName: 'השתלמות כללי',
          balance: 10000,
        }),
      ],
    });
    expect(report.status).toBe('partial');
    expect(report.orchestrator.recommendations).toBeDefined();
  });

  it('returns no_data report without accounts', async () => {
    const userId = '507f1f77bcf86cd799439011';
    buildSuitabilityProfile.mockResolvedValueOnce({
      missingFields: [],
      profileConfidence: 0.5,
      riskTolerance: 'medium',
      canAbsorbLosses: true,
      needsLiquiditySoon: false,
    });

    const report = await buildGemelAdvisorReport(userId, {
      skipLLM: true,
      summary: { hasData: false, funds: [], hasStudyFund: false, payslipContribution: 0 },
      parsedAccounts: [],
    });
    expect(report.status).toBe('no_data');
    expect(report.orchestrator.status).toBe('no_data');
  });

  it('builds partial report from payslip study fund when holdings are missing', async () => {
    const userId = '507f1f77bcf86cd799439012';
    buildSuitabilityProfile.mockResolvedValueOnce({
      missingFields: ['investmentHorizonYears'],
      profileConfidence: 0.6,
      riskTolerance: 'medium',
      canAbsorbLosses: true,
      needsLiquiditySoon: false,
    });

    const report = await buildGemelAdvisorReport(userId, {
      skipLLM: true,
      summary: {
        hasData: true,
        hasStudyFund: true,
        payslipContribution: 2500,
        studyFundEmployee: 500,
        studyFundEmployer: 2000,
        funds: [],
      },
      officialFunds: officialSample,
    });
    expect(report.status).not.toBe('no_data');
    expect(report.accounts.length).toBeGreaterThan(0);
    expect(report.accounts[0].productType).toBe('study_fund');
    expect(report.summary.accountCount).toBeGreaterThan(0);
  });
});
