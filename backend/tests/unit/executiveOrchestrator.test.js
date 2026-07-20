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

    const mergedAction = result.priorityActions.find(a =>
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
    expect(result.priorityActions.length).toBeGreaterThan(0);
    expect(result.priorityActions[0].title).toMatch(/דמי ניהול/);
  });

  it('does not invent savings when impact amount is missing', () => {
    const pkg = buildAgentPackage('payslip', {
      legacyRecs: [{ title: 'בדוק תלוש', reason: 'ללא סכום', urgency: 'low' }],
    });
    const result = runGlobalPriorityEngine({ payslip: pkg });
    expect(result.priorityActions[0].possibleSavings).toBeNull();
  });

  it('builds all seven report sections', () => {
    const pension = buildAgentPackage('pension', {
      legacyRecs: [{ title: 'פנסיה', reason: 'בדיקה', urgency: 'medium', impactAmount: 500 }],
    });
    const engine = runGlobalPriorityEngine({ pension });
    const report = buildExecutiveReport({
      userId: 'u1',
      packages: { pension },
      priorityEngine: engine,
      globalScore: { score: 72, label: 'טוב' },
      conflicts: engine.conflicts,
    });

    expect(report.sections.executiveSummary).toBeTruthy();
    expect(Array.isArray(report.sections.topPriorityActions)).toBe(true);
    expect(Array.isArray(report.sections.financialStrengths)).toBe(true);
    expect(Array.isArray(report.sections.risks)).toBe(true);
    expect(Array.isArray(report.sections.opportunities)).toBe(true);
    expect(report.sections.roadmap).toBeTruthy();
    expect(report.sections.thingsToReviewRegularly.length).toBeGreaterThan(0);
  });

  it('includes confidence and sourceAgents in priority actions', () => {
    const pkg = buildAgentPackage('pension', {
      legacyRecs: [{
        title: 'איחוד קרנות',
        reason: 'פיזור',
        urgency: 'high',
        impactAmount: 3000,
        confidenceScore: 80,
      }],
    });
    const engine = runGlobalPriorityEngine({ pension: pkg });
    const report = buildExecutiveReport({
      userId: 'u1',
      packages: { pension: pkg },
      priorityEngine: engine,
      conflicts: [],
    });
    const action = report.sections.topPriorityActions[0];
    expect(action.confidence).not.toBeNull();
    expect(action.sourceAgents).toContain('pension');
  });
});
