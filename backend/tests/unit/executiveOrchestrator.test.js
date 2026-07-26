'use strict';

const {
  runGlobalPriorityEngine,
  mergeSimilarItems,
  detectConflicts,
  mergeCrossDomainCashFlow,
} = require('../../services/executiveOrchestrator/globalPriorityEngine');
const { structuredRecommendation } = require('../../utils/executiveAgentSchema');
const { buildAgentPackage } = require('../../services/executiveOrchestrator/agentOutputNormalizer');
const { buildExecutiveReport } = require('../../services/executiveOrchestrator/reportSectionBuilder');
const { isMissingDataItem, isMaterial } = require('../../services/executiveOrchestrator/reportCoordinator');

describe('executive global priority engine — extended', () => {
  it('detects emergency fund vs idle cash conflict', () => {
    const items = [
      structuredRecommendation({ title: 'בניית כרית חירום', explanation: 'חשוב לשמור כרית', category: 'emergency' }),
      structuredRecommendation({ title: 'השקעת מזומן עודף', explanation: 'יש מזומן idle', category: 'investment' }),
    ].map((item, i) => ({
      ...item,
      sourceAgents: [i === 0 ? 'onboarding' : 'gemel'],
      mergeGroup: i === 0 ? 'emergency' : 'investment',
    }));

    const conflicts = detectConflicts(items);
    expect(conflicts.some(c => c.id === 'emergency_vs_invest')).toBe(true);
  });

  it('merges insurance waste with cash flow across domains', () => {
    const result = runGlobalPriorityEngine({
      insurance: buildAgentPackage('insurance', {
        legacyRecs: [{
          title: 'צמצום פרמיות ביטוח',
          reason: 'פרמיות כפולות',
          urgency: 'high',
          impactAmount: 400,
        }],
      }),
      payslip: buildAgentPackage('payslip', {
        legacyRecs: [{
          title: 'תזרים חודשי לחוץ',
          reason: 'הוצאות גבוהות',
          urgency: 'medium',
        }],
      }),
    });

    const mergedAction = result.scoredItems.find(a =>
      a.sourceAgents?.includes('insurance') && a.sourceAgents?.includes('payslip'),
    );
    expect(mergedAction).toBeTruthy();
    expect(mergedAction.explanation).toMatch(/ביטוח|תזרים/);
  });

  it('continues with partial agent failure packages', () => {
    const pension = buildAgentPackage('pension', {
      legacyRecs: [{ title: 'הורדת דמי ניהול', reason: 'גבוהים', urgency: 'high', impactAmount: 10000 }],
    });
    const empty = buildAgentPackage('insurance', { status: 'no_data' });

    const result = runGlobalPriorityEngine({ pension, insurance: empty });
    expect(result.scoredItems.length).toBeGreaterThan(0);
    expect(result.scoredItems[0].title).toMatch(/דמי ניהול/);
  });

  it('does not invent savings when impact amount is missing', () => {
    const pkg = buildAgentPackage('payslip', {
      legacyRecs: [{ title: 'בדוק תלוש', reason: 'ללא סכום', urgency: 'low' }],
    });
    const result = runGlobalPriorityEngine({ payslip: pkg });
    expect(result.scoredItems[0].possibleSavings).toBeNull();
  });

  it('builds v2.1 agent-first report sections', () => {
    const pension = buildAgentPackage('pension', {
      legacyRecs: [{ title: 'פנסיה', reason: 'בדיקה', urgency: 'medium', impactAmount: 500 }],
      data: { fundAdvice: { funds: [{}] } },
    });
    const engine = runGlobalPriorityEngine({ pension });
    const report = buildExecutiveReport({
      userId: 'u1',
      packages: { pension, gemel: buildAgentPackage('gemel', { status: 'no_data' }), insurance: buildAgentPackage('insurance', { status: 'no_data' }), payslip: buildAgentPackage('payslip', { status: 'no_data' }) },
      priorityEngine: engine,
      globalScore: { score: 72, label: 'טוב', categories: [] },
      conflicts: engine.conflicts,
    });

    expect(report.meta.reportVersion).toBe('2.1.0');
    expect(report.sections.executiveSummary).toBeTruthy();
    expect(report.sections.agentReport.agentSections).toHaveLength(4);
    expect(report.sections.agentReport.agentSections.find(s => s.agentId === 'pension').dataStatus).toBe('available');
    expect(report.sections.preservedRecommendations.length).toBeGreaterThan(0);
  });

  it('includes source agent in preserved recommendations', () => {
    const pkg = buildAgentPackage('pension', {
      legacyRecs: [{
        title: 'איחוד קרנות',
        reason: 'פיזור',
        urgency: 'high',
        impactAmount: 3000,
        confidenceScore: 80,
      }],
      data: { fundAdvice: { funds: [{}] } },
    });
    const engine = runGlobalPriorityEngine({ pension: pkg });
    const report = buildExecutiveReport({
      userId: 'u1',
      packages: { pension: pkg, gemel: buildAgentPackage('gemel', { status: 'no_data' }), insurance: buildAgentPackage('insurance', { status: 'no_data' }), payslip: buildAgentPackage('payslip', { status: 'no_data' }) },
      priorityEngine: engine,
      conflicts: [],
    });
    const rec = report.sections.preservedRecommendations[0];
    expect(rec.confidence).not.toBeNull();
    expect(rec.agentId).toBe('pension');
  });

  it('separates missing-data from financial recommendations in agent sections', () => {
    const onboarding = buildAgentPackage('onboarding', {
      legacyRecs: [{ title: 'העלאת תלושי שכר', reason: 'נדרש לניתוח', urgency: 'high' }],
    });
    const pension = buildAgentPackage('pension', {
      legacyRecs: [{ title: 'הורדת דמי ניהול', reason: 'גבוהים', urgency: 'high', impactAmount: 5000 }],
      data: { fundAdvice: { funds: [{}] } },
    });
    const engine = runGlobalPriorityEngine({ onboarding, pension });
    const report = buildExecutiveReport({
      userId: 'u1',
      packages: { onboarding, pension, gemel: buildAgentPackage('gemel', { status: 'no_data' }), insurance: buildAgentPackage('insurance', { status: 'no_data' }), payslip: buildAgentPackage('payslip', { status: 'no_data' }) },
      priorityEngine: engine,
      conflicts: [],
    });

    const payslipSection = report.sections.agentReport.agentSections.find(s => s.agentId === 'payslip');
    expect(payslipSection.dataStatus).toBe('missing');
    expect(report.sections.preservedRecommendations.every(r => r.agentId !== 'onboarding')).toBe(true);
  });
});

describe('report coordinator helpers', () => {
  it('flags upload tasks as missing data', () => {
    const item = structuredRecommendation({
      title: 'העלאת תלוש שכר',
      explanation: 'נדרש לניתוח',
      itemKind: 'missing_data',
      sourceAgent: 'onboarding',
    });
    expect(isMissingDataItem({ ...item, sourceAgents: ['onboarding'] })).toBe(true);
  });

  it('treats small annual savings as immaterial', () => {
    const item = structuredRecommendation({
      title: 'דמי ניהול',
      explanation: 'הפרש קטן',
      possibleSavings: 12,
    });
    expect(isMaterial(item)).toBe(false);
  });
});
