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

  it('builds v2 report sections with decision flow buckets', () => {
    const pension = buildAgentPackage('pension', {
      legacyRecs: [{ title: 'פנסיה', reason: 'בדיקה', urgency: 'medium', impactAmount: 500 }],
    });
    const engine = runGlobalPriorityEngine({ pension });
    const report = buildExecutiveReport({
      userId: 'u1',
      packages: { pension },
      priorityEngine: engine,
      globalScore: { score: 72, label: 'טוב', categories: [] },
      conflicts: engine.conflicts,
    });

    expect(report.meta.reportVersion).toBe('2.0.0');
    expect(report.sections.executiveSummary).toBeTruthy();
    expect(report.sections.personalOverview).toBeTruthy();
    expect(report.sections.mainDecisions).toBeTruthy();
    expect(report.sections.actionPlan).toBeTruthy();
    expect(report.sections.actionPlan.doNow).toBeTruthy();
    expect(report.sections.allRecommendations.length).toBeGreaterThan(0);
    expect(report.sections.thingsToReviewRegularly.length).toBeGreaterThan(0);
  });

  it('includes sourceAgents in classified recommendations', () => {
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
    const rec = report.sections.allRecommendations[0];
    expect(rec.confidence).not.toBeNull();
    expect(rec.sourceAgents).toContain('pension');
  });

  it('separates missing-data tasks from financial recommendations', () => {
    const onboarding = buildAgentPackage('onboarding', {
      legacyRecs: [{ title: 'העלאת תלושי שכר', reason: 'נדרש לניתוח', urgency: 'high' }],
    });
    const pension = buildAgentPackage('pension', {
      legacyRecs: [{ title: 'הורדת דמי ניהול', reason: 'גבוהים', urgency: 'high', impactAmount: 5000 }],
    });
    const engine = runGlobalPriorityEngine({ onboarding, pension });
    const report = buildExecutiveReport({
      userId: 'u1',
      packages: { onboarding, pension },
      priorityEngine: engine,
      conflicts: [],
    });

    expect(report.sections.actionPlan.missingData.some(i => /תלוש/i.test(i.title))).toBe(true);
    expect(report.sections.mainDecisions.every(d => !/העלא/i.test(d.title))).toBe(true);
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
