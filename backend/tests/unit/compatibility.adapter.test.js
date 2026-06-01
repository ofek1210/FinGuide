const { buildCompatibleAnalysisData } = require('../../services/extraction-v2/adapters/compatibility.adapter');

describe('compatibility.adapter', () => {
  test('maps warning categories and contribution detection metadata', () => {
    const analysis = buildCompatibleAnalysisData({
      extractionResult: {
        fields: {
          period_month: { value: '2024-06' },
          pension_base_salary: { value: 26000 },
          pension_employee: { value: 1560 },
          pension_employer: { value: 1690 },
          study_fund_base_salary: { value: 20000 },
          study_fund_employee: { value: 500 },
          study_fund_employer: { value: 1500 },
        },
      },
      validationResult: {
        warnings: [{ message: 'Pension contribution lines found but employee/employer roles were ambiguous.' }],
        errors: [],
        isValid: true,
        needsReview: false,
        status: 'ok',
      },
    });

    expect(analysis.quality.warning_categories).toContain('ambiguous.contributions.pension_roles');
    expect(analysis.contributions.pension.detection.sectionDetected).toBe(true);
    expect(analysis.contributions.pension.detection.noDeposit).toBe(false);
    expect(analysis.contributions.study_fund.detection.sectionDetected).toBe(true);
    expect(analysis.quality.fields.pension_employee.abstained).toBe(false);
  });
});
