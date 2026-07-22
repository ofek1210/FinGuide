'use strict';

const {
  runGlobalPriorityEngine,
  mergeSimilarItems,
  computePriorityScore,
} = require('../../services/executiveOrchestrator/globalPriorityEngine');
const { structuredRecommendation } = require('../../utils/executiveAgentSchema');
const { buildAgentPackage } = require('../../services/executiveOrchestrator/agentOutputNormalizer');

describe('executive global priority engine', () => {
  it('merges similar insurance and cash-flow recommendations', () => {
    const insuranceRec = structuredRecommendation({
      title: 'צמצום כפילויות ביטוח',
      explanation: 'פרמיות כפולות גובות ממך כסף מיותר',
      severity: 'high',
      category: 'insurance_waste',
      possibleSavings: 300,
      mergeKey: 'insurance_cost',
    });
    const payslipRec = structuredRecommendation({
      title: 'תזרים חודשי לחוץ',
      explanation: 'הוצאות חודשיות גבוהות יחסית להכנסה',
      severity: 'medium',
      category: 'cash_flow',
      mergeKey: 'cash_flow',
    });

    const merged = mergeSimilarItems([
      { ...insuranceRec, sourceAgents: ['insurance'], mergeGroup: 'insurance_cost' },
      { ...payslipRec, sourceAgents: ['payslip'], mergeGroup: 'cash_flow' },
    ]);

    expect(merged).toHaveLength(2);
  });

  it('ranks pension fees above small insurance waste when long-term impact is higher', () => {
    const pensionPkg = buildAgentPackage('pension', {
      legacyRecs: [{
        type: 'fee',
        title: 'הורדת דמי ניהול בפנסיה',
        reason: 'דמי ניהול מעל השוק',
        urgency: 'high',
        financialImpact: '₪50,000 עד פרישה',
        impactAmount: 50000,
      }],
    });
    const insurancePkg = buildAgentPackage('insurance', {
      legacyRecs: [{
        type: 'duplicate',
        title: 'ביטול כפל ביטוח',
        reason: 'פרמיה כפולה',
        urgency: 'high',
        financialImpact: '₪200/חודש',
        impactAmount: 200,
      }],
    });

    const result = runGlobalPriorityEngine({ pension: pensionPkg, insurance: insurancePkg });
    expect(result.scoredItems.length).toBeGreaterThan(0);
    expect(result.scoredItems[0].title).toMatch(/דמי ניהול|פנסיה/i);
    expect(result.scoredItems[0].priorityScore).toBeGreaterThan(
      result.scoredItems[1]?.priorityScore ?? 0,
    );
  });

  it('preserves all recommendations after merge (no truncation)', () => {
    const recs = Array.from({ length: 12 }, (_, i) => ({
      type: `rec-${i}`,
      title: `המלצה ${i}`,
      reason: `סיבה ${i}`,
      urgency: i < 4 ? 'high' : 'medium',
      financialImpact: `₪${(i + 1) * 1000}`,
      impactAmount: (i + 1) * 1000,
    }));
    const pkg = buildAgentPackage('pension', { legacyRecs: recs });
    const result = runGlobalPriorityEngine({ pension: pkg });
    expect(result.scoredItems.length).toBe(12);
    expect(result.stats.preservedCount).toBe(12);
  });

  it('computes higher score for critical high-savings items', () => {
    const high = computePriorityScore({
      severity: 'critical',
      possibleSavings: 20000,
      confidence: 0.9,
      financialCategory: 'pension_fees',
    });
    const low = computePriorityScore({
      severity: 'low',
      possibleSavings: 100,
      confidence: 0.5,
      financialCategory: 'general',
    });
    expect(high).toBeGreaterThan(low);
  });
});
