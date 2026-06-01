const {
  detectFundContributionStatus,
  detectFundFindingsForDocuments,
  detectOnboardingFundMismatches,
  buildFundDepositFindings,
  buildContributionDetection,
} = require('../utils/detectFundWithoutDeposit');

describe('detectFundContributionStatus', () => {
  test('study fund: base present and deposits zero → applies', () => {
    const result = detectFundContributionStatus(
      {
        contributions: {
          study_fund: {
            base_salary_for_study_fund: 20800,
            employee: 0,
            employer: 0,
            detection: {
              sectionDetected: true,
              noDeposit: true,
            },
          },
        },
        quality: { warning_categories: [] },
      },
      'study_fund',
    );

    expect(result.applies).toBe(true);
    expect(result.fundSectionDetected).toBe(true);
    expect(result.noDeposit).toBe(true);
  });

  test('study fund: valid deposits → does not apply', () => {
    const result = detectFundContributionStatus(
      {
        contributions: {
          study_fund: {
            base_salary_for_study_fund: 20800,
            employee: 520,
            employer: 1560,
          },
        },
        quality: { warning_categories: [] },
      },
      'study_fund',
    );

    expect(result.applies).toBe(false);
  });

  test('study fund: missing line warning → does not apply', () => {
    const result = detectFundContributionStatus(
      {
        contributions: { study_fund: {} },
        quality: {
          warning_categories: ['missing.contributions.study_line'],
        },
      },
      'study_fund',
    );

    expect(result.applies).toBe(false);
    expect(result.missingLine).toBe(true);
  });

  test('pension: ambiguous roles → low confidence', () => {
    const result = detectFundContributionStatus(
      {
        contributions: {
          pension: {
            base_salary_for_pension: 26000,
            employee: null,
            employer: null,
          },
        },
        quality: {
          warning_categories: ['ambiguous.contributions.pension_roles'],
        },
      },
      'pension',
    );

    expect(result.applies).toBe(true);
    expect(result.confidence).toBe('low');
    expect(result.ambiguousRoles).toBe(true);
  });

  test('pension: severance only does not count as no deposit', () => {
    const result = detectFundContributionStatus(
      {
        contributions: {
          pension: {
            base_salary_for_pension: 26000,
            employee: 0,
            employer: 0,
            severance: 1560,
          },
        },
        quality: { warning_categories: [] },
      },
      'pension',
    );

    expect(result.noDeposit).toBe(false);
    expect(result.applies).toBe(false);
  });
});

describe('detectFundFindingsForDocuments', () => {
  test('aggregates multiple payslips for same fund', () => {
    const findings = detectFundFindingsForDocuments([
      {
        _id: '1',
        status: 'completed',
        originalName: 'a.pdf',
        analysisData: {
          period: { month: '2024-05' },
          contributions: {
            study_fund: {
              base_salary_for_study_fund: 10000,
              employee: 0,
              employer: 0,
              detection: { sectionDetected: true, noDeposit: true },
            },
          },
          quality: { warning_categories: [] },
        },
      },
      {
        _id: '2',
        status: 'completed',
        originalName: 'b.pdf',
        analysisData: {
          period: { month: '2024-06' },
          contributions: {
            study_fund: {
              base_salary_for_study_fund: 11000,
              employee: 0,
              employer: 0,
              detection: { sectionDetected: true, noDeposit: true },
            },
          },
          quality: { warning_categories: [] },
        },
      },
    ]);

    expect(findings).toHaveLength(1);
    expect(findings[0].id).toBe('study_fund_no_deposit');
    expect(findings[0].details).toContain('2 תלושים');
  });
});

describe('detectOnboardingFundMismatches', () => {
  test('hasStudyFund true + latest payslip without deposit → mismatch', () => {
    const findings = detectOnboardingFundMismatches(
      {
        onboarding: {
          data: { hasStudyFund: true, hasPension: false },
        },
      },
      [
        {
          _id: 'x',
          status: 'completed',
          uploadedAt: '2024-06-01',
          metadata: { category: 'payslip' },
          originalName: 'june.pdf',
          analysisData: {
            period: { month: '2024-06' },
            contributions: {
              study_fund: {
                base_salary_for_study_fund: 20000,
                employee: 0,
                employer: 0,
                detection: { sectionDetected: true, noDeposit: true },
              },
            },
            quality: { warning_categories: [] },
          },
        },
      ],
    );

    expect(findings).toHaveLength(1);
    expect(findings[0].id).toBe('onboarding_study_fund_mismatch');
  });

  test('hasPension true + valid deposits → no mismatch', () => {
    const findings = detectOnboardingFundMismatches(
      {
        onboarding: {
          data: { hasPension: true },
        },
      },
      [
        {
          _id: 'x',
          status: 'completed',
          uploadedAt: '2024-06-01',
          metadata: { category: 'payslip' },
          analysisData: {
            period: { month: '2024-06' },
            contributions: {
              pension: { employee: 500, employer: 600 },
            },
            quality: { warning_categories: [] },
          },
        },
      ],
    );

    expect(findings).toHaveLength(0);
  });
});

describe('buildContributionDetection', () => {
  test('marks noDeposit when both sides are zero', () => {
    expect(
      buildContributionDetection({
        sectionDetected: true,
        employee: 0,
        employer: 0,
      }),
    ).toEqual({
      sectionDetected: true,
      employeeAmount: 0,
      employerAmount: 0,
      severanceAmount: null,
      noDeposit: true,
    });
  });
});

describe('buildFundDepositFindings', () => {
  test('merges document and onboarding findings without duplicate ids', () => {
    const user = { onboarding: { data: { hasStudyFund: true } } };
    const documents = [
      {
        _id: 'x',
        status: 'completed',
        uploadedAt: '2024-06-01',
        metadata: { category: 'payslip' },
        originalName: 'june.pdf',
        analysisData: {
          period: { month: '2024-06' },
          contributions: {
            study_fund: {
              base_salary_for_study_fund: 20000,
              employee: 0,
              employer: 0,
              detection: { sectionDetected: true, noDeposit: true },
            },
          },
          quality: { warning_categories: [] },
        },
      },
    ];

    const findings = buildFundDepositFindings(documents, user);
    const ids = findings.map(f => f.id);

    expect(ids).toContain('study_fund_no_deposit');
    expect(ids).toContain('onboarding_study_fund_mismatch');
    expect(new Set(ids).size).toBe(ids.length);
  });
});
