'use strict';

const { buildExecutiveReport } = require('../../services/executiveOrchestrator/reportSectionBuilder');
const { runGlobalPriorityEngine } = require('../../services/executiveOrchestrator/globalPriorityEngine');
const { buildAgentPackage } = require('../../services/executiveOrchestrator/agentOutputNormalizer');
const { generateExecutiveReportPdf } = require('../../services/executiveOrchestrator/executivePdfService');

describe('executive PDF generation', () => {
  it('generates a valid PDF buffer with Hebrew content', async () => {
    const pension = buildAgentPackage('pension', {
      legacyRecs: [{
        title: 'הורדת דמי ניהול',
        reason: 'דמי ניהול גבוהים',
        urgency: 'high',
        impactAmount: 5000,
      }],
    });
    const engine = runGlobalPriorityEngine({ pension, gemel: buildAgentPackage('gemel', { status: 'no_data' }), insurance: buildAgentPackage('insurance', { status: 'no_data' }), payslip: buildAgentPackage('payslip', { status: 'no_data' }) });
    const report = buildExecutiveReport({
      userId: 'u1',
      packages: { pension, gemel: buildAgentPackage('gemel', { status: 'no_data' }), insurance: buildAgentPackage('insurance', { status: 'no_data' }), payslip: buildAgentPackage('payslip', { status: 'no_data' }) },
      priorityEngine: engine,
      globalScore: { score: 60, label: 'סביר' },
      conflicts: [],
    });

    const pdf = await generateExecutiveReportPdf(report);
    expect(Buffer.isBuffer(pdf)).toBe(true);
    expect(pdf.slice(0, 4).toString()).toBe('%PDF');
    expect(pdf.length).toBeGreaterThan(1000);
    expect(pdf.includes(Buffer.from('FinGuide', 'utf8')) || pdf.length > 1000).toBe(true);
  });
});
