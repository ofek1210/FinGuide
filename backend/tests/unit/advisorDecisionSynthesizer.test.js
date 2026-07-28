'use strict';

const {
  buildPensionDecision,
  buildGemelDecision,
  buildInsuranceDecision,
  buildActionPlan,
  VERDICT,
} = require('../../services/executiveOrchestrator/advisorDecisionSynthesizer');
const { buildAgentPackage } = require('../../services/executiveOrchestrator/agentOutputNormalizer');

describe('advisorDecisionSynthesizer', () => {
  it('pension: insufficient confidence when data is weak and savings immaterial', () => {
    const pkg = buildAgentPackage('pension', {
      primaryRecs: [{
        title: 'השוואת מסלולים',
        explanation: 'חסרים נתונים',
        confidence: 'insufficient_data',
        financialImpact: { amount: 20, period: 'annual' },
        evidence: { alternatives: [] },
      }],
      data: {},
    });

    const decision = buildPensionDecision(pkg);
    expect(decision.verdict).toBe(VERDICT.INSUFFICIENT);
    expect(decision.verdictLabelHe).toMatch(/ביטחון/);
    expect(decision.actionable).toBe(false);
  });

  it('pension: picks a single recommended fund from alternatives', () => {
    const pkg = buildAgentPackage('pension', {
      primaryRecs: [{
        title: 'דמי ניהול',
        explanation: 'גבוהים מהשוק',
        whyItMatters: 'חיסכון משמעותי',
        nextStep: 'בדקו מעבר לקרן אלטשולר',
        confidence: 'high',
        portfolioSelection: { priorityScore: 90 },
        financialImpact: { amount: 2400, period: 'annual' },
        evidence: {
          alternatives: [{
            fundName: 'אלטשולר שחם כללי',
            managingCompany: 'אלטשולר שחם',
            reasons: ['דמי ניהול נמוכים יותר', 'תשואה תחרותית'],
          }],
        },
      }],
      data: {},
    });

    const decision = buildPensionDecision(pkg);
    expect(decision.verdict).toBe(VERDICT.RECOMMEND);
    expect(decision.recommendedProduct.name).toBe('אלטשולר שחם כללי');
    expect(decision.whySelected).toMatch(/דמי ניהול/);
    expect(decision.annualSavings).toBe(2400);
    expect(decision.actionable).toBe(true);
  });

  it('gemel: returns best alternative with fees/performance/risk comparison', () => {
    const pkg = buildAgentPackage('gemel', {
      data: {
        marketAdvice: {
          overallVerdict: 'SWITCH',
          funds: [{
            productName: 'השתלמות מנורה',
            companyName: 'מנורה',
            verdict: 'SWITCH',
            userFee: 0.9,
            marketFee: 0.45,
            userReturn5Y: 4.2,
            marketReturn5Y: 6.1,
            annualSavingsEstimate: 1800,
            riskNote: 'בינוני',
            alternatives: [{
              fundName: 'השתלמות הראל',
              companyName: 'הראל',
              managementFeeBalanceAvgPct: 0.45,
              return5YearsAnnualizedPct: 6.1,
              reasons: ['דמי ניהול נמוכים יותר'],
              tradeoffs: ['חשיפת מניות דומה'],
            }],
          }],
        },
      },
    });

    const decision = buildGemelDecision(pkg);
    expect(decision.verdict).toBe(VERDICT.RECOMMEND);
    expect(decision.recommendedProduct.name).toBe('השתלמות הראל');
    expect(decision.comparison.fees.current).toBe(0.9);
    expect(decision.comparison.fees.alternative).toBe(0.45);
    expect(decision.comparison.performance.alternative).toBe(6.1);
    expect(decision.comparison.risk).toBeTruthy();
  });

  it('insurance: STAY maps to keep; SWITCH maps to consider_replace', () => {
    const stay = buildInsuranceDecision(buildAgentPackage('insurance', {
      data: {
        policyCount: 2,
        duplicateCount: 0,
        marketAdvice: { overallVerdict: 'STAY', overallVerdictLabelHe: 'הישאר' },
      },
    }));
    expect(stay.verdict).toBe(VERDICT.KEEP);
    expect(stay.bullets.length).toBeGreaterThan(0);
    expect(stay.actionable).toBe(false);

    const swap = buildInsuranceDecision(buildAgentPackage('insurance', {
      legacyRecs: [{ title: 'ביטול כפל', reason: 'פרמיה כפולה', urgency: 'high', impactAmount: 2400 }],
      data: {
        policyCount: 3,
        duplicateCount: 1,
        totalMonthlyWaste: 200,
        marketAdvice: { overallVerdict: 'SWITCH', overallVerdictLabelHe: 'שקול החלפה' },
      },
    }));
    expect(swap.verdict).toBe(VERDICT.CONSIDER_REPLACE);
    expect(swap.bullets.length).toBeGreaterThan(0);
    expect(swap.bullets.length).toBeLessThanOrEqual(5);
    expect(swap.actionable).toBe(true);
  });

  it('action plan sorts by impact and skips non-actionable decisions', () => {
    const decisions = [
      {
        agentId: 'insurance',
        actionable: true,
        nextAction: 'בטלו כפל ביטוח',
        expectedBenefit: 'חיסכון שנתי',
        annualSavings: 500,
        whySelected: 'כפילות',
        verdictLabelHe: 'לשקול',
      },
      {
        agentId: 'pension',
        actionable: true,
        nextAction: 'עברו לקרן מומלצת',
        expectedBenefit: 'חיסכון דמי ניהול',
        annualSavings: 3000,
        whySelected: 'דמי ניהול גבוהים',
        verdictLabelHe: 'מומלץ',
      },
      {
        agentId: 'gemel',
        actionable: false,
        nextAction: 'אין פעולה',
        whySelected: 'תקין',
        verdictLabelHe: 'להישאר',
      },
    ];

    const plan = buildActionPlan({ domainDecisions: decisions, scoredItems: [] });
    expect(plan).toHaveLength(2);
    expect(plan[0].agentId).toBe('pension');
    expect(plan[0].estimatedAnnualSavings).toBe(3000);
    expect(plan[0].priority).toBe('high');
    expect(plan[1].agentId).toBe('insurance');
  });
});
