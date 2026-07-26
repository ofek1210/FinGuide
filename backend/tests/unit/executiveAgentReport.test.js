'use strict';

const { buildAgentPackage } = require('../../services/executiveOrchestrator/agentOutputNormalizer');
const {
  buildAgentFirstReport,
  NO_RECS_HE,
  MISSING_HE,
  ERROR_HE,
} = require('../../services/executiveOrchestrator/agentReportSections');
const { buildExecutiveReport } = require('../../services/executiveOrchestrator/reportSectionBuilder');
const { runGlobalPriorityEngine } = require('../../services/executiveOrchestrator/globalPriorityEngine');

function allFourPackages({
  pensionRec = true,
  gemelRec = true,
  insuranceRec = true,
  payslipRec = true,
  payslipData = true,
  insuranceData = true,
  gemelData = true,
  pensionData = true,
  pensionError = false,
  gemelError = false,
  insuranceError = false,
  payslipError = false,
} = {}) {
  const pension = pensionError
    ? buildAgentPackage('pension', { status: 'error', humanExplanation: 'שגיאה' })
    : pensionData
      ? buildAgentPackage('pension', {
        legacyRecs: pensionRec ? [{ title: 'הורדת דמי ניהול', reason: 'גבוהים', urgency: 'high' }] : [],
        data: { totalMonthlyContribution: 3000, fundAdvice: { funds: [{ productName: 'פנסיה' }] } },
        humanExplanation: 'ניתוח פנסיה הושלם.',
      })
      : buildAgentPackage('pension', { status: 'no_data' });

  const gemel = gemelError
    ? buildAgentPackage('gemel', { status: 'error', humanExplanation: 'שגיאה' })
    : gemelData
      ? buildAgentPackage('gemel', {
        legacyRecs: gemelRec ? [{ title: 'השוואת דמי ניהול בגמל', reason: 'מעל ממוצע', urgency: 'high' }] : [],
        data: {
          totalBalance: 85000,
          fundCount: 2,
          marketAdvice: {
            funds: [
              { productName: 'קופת גמל', companyName: 'מנורה', userFee: 0.9, verdictLabelHe: 'גבוה' },
              { productName: 'קרן השתלמות', companyName: 'הראל', userFee: 0.5, verdictLabelHe: 'תחרותי' },
            ],
          },
          advisorReport: { accounts: [{ productName: 'גמל', balance: 50000 }] },
        },
        humanExplanation: 'ניתוח גמל הושלם.',
      })
      : buildAgentPackage('gemel', { status: 'no_data' });

  const insurance = insuranceError
    ? buildAgentPackage('insurance', { status: 'error', humanExplanation: 'שגיאה' })
    : insuranceData
      ? buildAgentPackage('insurance', {
        legacyRecs: insuranceRec ? [{ title: 'ביטול כפל', reason: 'פרמיה כפולה', urgency: 'high', impactAmount: 2400 }] : [],
        data: { duplicateCount: insuranceRec ? 1 : 0, policyCount: 3 },
        humanExplanation: insuranceRec ? 'ניתוח ביטוח הושלם.' : 'נבדק — ללא המלצות.',
      })
      : buildAgentPackage('insurance', { status: 'no_data' });

  const payslip = payslipError
    ? buildAgentPackage('payslip', { status: 'error', humanExplanation: 'שגיאה' })
    : payslipData
      ? buildAgentPackage('payslip', {
        legacyRecs: payslipRec ? [{ title: 'בדיקת הפקדות', reason: 'חריגה', urgency: 'medium' }] : [],
        data: { payslipCount: 3 },
        humanExplanation: 'ניתוח תלושים הושלם.',
      })
      : buildAgentPackage('payslip', { status: 'no_data' });

  return { pension, gemel, insurance, payslip };
}

describe('executive agent-first report — cases A–F', () => {
  it('Case A: all four agents have data and recommendations', () => {
    const packages = allFourPackages();
    const report = buildAgentFirstReport(packages);

    expect(report.agentSections).toHaveLength(4);
    expect(report.agentSections.map(s => s.agentId)).toEqual(['pension', 'gemel', 'insurance', 'payslip']);
    for (const section of report.agentSections) {
      expect(section.dataStatus).toBe('available');
      expect(section.recommendationStatus).toBe('hasRecommendations');
      expect(section.recommendations.length).toBeGreaterThan(0);
      expect(section.statusMessage).toBeNull();
    }
  });

  it('Case B: Gemel has data and recommendations — products appear', () => {
    const packages = allFourPackages({ pensionRec: false, insuranceRec: false, payslipRec: false, payslipData: false, insuranceData: false, pensionData: false });
    const gemelSection = buildAgentFirstReport(packages).agentSections.find(s => s.agentId === 'gemel');

    expect(gemelSection.dataStatus).toBe('available');
    expect(gemelSection.recommendationStatus).toBe('hasRecommendations');
    expect(gemelSection.dataSummary.some(d => /קופת גמל|גמל/.test(d.label))).toBe(true);
    expect(gemelSection.recommendations[0].title).toMatch(/גמל/);
  });

  it('Case C: Insurance has data but no recommendations', () => {
    const packages = allFourPackages({ insuranceRec: false, pensionRec: false, gemelRec: false, payslipRec: false, pensionData: false, gemelData: false, payslipData: false });
    const insuranceSection = buildAgentFirstReport(packages).agentSections.find(s => s.agentId === 'insurance');

    expect(insuranceSection.dataStatus).toBe('available');
    expect(insuranceSection.recommendationStatus).toBe('noRecommendations');
    expect(insuranceSection.statusMessage).toBe(NO_RECS_HE);
    expect(insuranceSection.recommendations).toHaveLength(0);
  });

  it('Case D: No payslip uploaded — missing data explained', () => {
    const packages = allFourPackages({ payslipData: false, pensionRec: false, gemelRec: false, insuranceRec: false, insuranceData: false, gemelData: false });
    const payslipSection = buildAgentFirstReport(packages).agentSections.find(s => s.agentId === 'payslip');

    expect(payslipSection.dataStatus).toBe('missing');
    expect(payslipSection.statusMessage).toBe(MISSING_HE);
    expect(payslipSection.missingDetail?.whatIsMissing).toMatch(/תלוש/);
    expect(payslipSection.recommendations).toHaveLength(0);
  });

  it('Case E: One agent errors — others still appear', () => {
    const packages = allFourPackages({ insuranceError: true, pensionRec: false, gemelRec: false, payslipRec: false });
    const report = buildAgentFirstReport(packages);
    const insuranceSection = report.agentSections.find(s => s.agentId === 'insurance');

    expect(insuranceSection.dataStatus).toBe('error');
    expect(insuranceSection.statusMessage).toBe(ERROR_HE);
    expect(report.agentSections).toHaveLength(4);
    expect(report.agentSections.find(s => s.agentId === 'pension').dataStatus).toBe('available');
  });

  it('Case F: Pension recommendation without monetary projection — no invented savings', () => {
    const packages = allFourPackages({
      gemelData: false,
      insuranceData: false,
      payslipData: false,
      pensionRec: true,
    });
    packages.pension = buildAgentPackage('pension', {
      legacyRecs: [{ title: 'בדיקת מסלול השקעה', reason: 'מסלול שמרני', urgency: 'medium' }],
      data: { fundAdvice: { funds: [{ productName: 'פנסיה' }] } },
    });

    const report = buildAgentFirstReport(packages);
    const pensionSection = report.agentSections.find(s => s.agentId === 'pension');

    expect(pensionSection.recommendations[0].expectedBenefit).toBeNull();
    expect(report.combinedSummary.notes.join(' ')).not.toMatch(/₪\d/);
    for (const action of report.whatToDo) {
      expect(action.action).not.toMatch(/₪\d/);
    }
  });
});

describe('executive report v2.1 structure', () => {
  it('builds agent-first sections without health score or professional mode', () => {
    const packages = allFourPackages();
    const engine = runGlobalPriorityEngine(packages);
    const report = buildExecutiveReport({
      userId: 'u1',
      packages,
      priorityEngine: engine,
      conflicts: [],
    });

    expect(report.meta.reportVersion).toBe('2.1.0');
    expect(report.sections.title).toBe('הדוח הפיננסי האישי שלי');
    expect(report.sections.agentReport.agentSections).toHaveLength(4);
    expect(report.sections.personalOverview).toBeUndefined();
    expect(report.sections.mainDecisions).toBeUndefined();
    expect(report.meta.globalHealthScore).toBeUndefined();
    expect(report.sections.preservedRecommendations.length).toBeGreaterThan(0);
    expect(report.sections.preservedRecommendations[0]).toMatchObject({
      agentId: expect.any(String),
      title: expect.any(String),
    });
  });
});
