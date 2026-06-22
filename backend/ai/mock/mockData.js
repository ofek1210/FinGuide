'use strict';

/**
 * Mock data for DEMO mode.
 * Returned by each agent when options.demo === true.
 * Represents a realistic Israeli user: age 35, married, 2 kids, salary Γé¬18,000.
 */

const DEMO_USER = {
  age: 35,
  retirementAge: 67,
  grossSalary: 18000,
  netSalary: 13200,
  maritalStatus: 'married',
  childrenCount: 2,
  isSmoker: false,
  employmentType: 'employee',
};

// ΓöÇΓöÇ Payslip mock ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

const MOCK_PAYSLIP_SUMMARY = {
  hasPayslips: true,
  count: 6,
  latestPeriod: '2026-05',
  grossSalary: DEMO_USER.grossSalary,
  netSalary: DEMO_USER.netSalary,
  pensionEmployee: 1080,   // 6% of 18,000
  pensionEmployer: 1500,   // 8.33% of 18,000
  studyFundEmployee: 450,  // 2.5%
  studyFundEmployer: 1350, // 7.5%
  incomeTax: 2800,
  nationalInsurance: 1020,
  totalMonthlyContribution: 2580,
  payslips: [
    { period: '2026-05', grossSalary: 18000, netSalary: 13200 },
    { period: '2026-04', grossSalary: 18000, netSalary: 13200 },
    { period: '2026-03', grossSalary: 17500, netSalary: 12800 },
    { period: '2026-02', grossSalary: 17500, netSalary: 12800 },
    { period: '2026-01', grossSalary: 17000, netSalary: 12400 },
    { period: '2025-12', grossSalary: 17000, netSalary: 12400 },
  ],
};

const MOCK_PAYSLIP_AGENT_RESULT = {
  agentId: 'payslip',
  status: 'success',
  message: null,
  data: MOCK_PAYSLIP_SUMMARY,
  recommendations: [
    {
      type: 'salary_trend_positive',
      title: '╫ö╫⌐╫¢╫¿ ╫⌐╫£╫Ü ╫ó╫£╫ö ╫æ-5.9% ╫æ-6 ╫ù╫ò╫ô╫⌐╫Ö╫¥ ╫ö╫É╫ù╫¿╫ò╫á╫Ö╫¥',
      reason: '╫ó╫£╫Ö╫Ö╫ö ╫₧-Γé¬17,000 ╫£-Γé¬18,000 ΓÇö ╫₧╫Æ╫₧╫ö ╫ù╫Ö╫ò╫æ╫Ö╫¬.',
      urgency: 'low',
      financialImpact: '+Γé¬12,000 ╫£╫⌐╫á╫ö',
      confidenceScore: 95,
    },
    {
      type: 'study_fund_optimization',
      title: '╫º╫¿╫ƒ ╫ö╫ö╫⌐╫¬╫£╫₧╫ò╫¬ ΓÇö ╫⌐╫º╫ò╫£ ╫£╫ö╫Æ╫ô╫Ö╫£ ╫ö╫ñ╫¿╫⌐╫ö',
      reason: '╫₧╫º╫í╫ò╫¥ ╫º╫¿╫ƒ ╫ö╫ö╫⌐╫¬╫£╫₧╫ò╫¬ ╫ñ╫ÿ╫ò╫¿ ╫₧╫₧╫í ╫ó╫£ ╫¿╫ò╫ò╫ù╫Ö╫¥ ╫ó╫ô ╫¬╫º╫¿╫ö ╫⌐╫á╫¬╫Ö╫¬.',
      urgency: 'medium',
      financialImpact: '╫ù╫Ö╫í╫¢╫ò╫ƒ ╫₧╫í ╫⌐╫£ ╫ó╫ô Γé¬3,000/╫⌐╫á╫ö',
      confidenceScore: 80,
    },
  ],
  durationMs: 120,
  explanation: '╫¬╫£╫ò╫⌐╫Ö ╫ö╫⌐╫¢╫¿ ╫⌐╫£╫Ü ╫₧╫¿╫É╫Ö╫¥ ╫₧╫Æ╫₧╫¬ ╫ó╫£╫Ö╫Ö╫ö ╫Ö╫ª╫Ö╫æ╫ö. ╫ö╫ñ╫¿╫⌐╫ò╫¬ ╫ö╫ñ╫á╫í╫Ö╫ö ╫¬╫º╫Ö╫á╫ò╫¬.',
};

// ΓöÇΓöÇ Insurance mock ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

const MOCK_INSURANCE_AGENT_RESULT = {
  agentId: 'insurance',
  status: 'success',
  message: null,
  data: {
    profile: {
      hasLifeInsurance: true,
      hasHealthInsurance: true,
      hasDisabilityInsurance: false,
      hasApartmentInsurance: true,
      hasCarInsurance: true,
    },
    duplicates: [],
    duplicateCount: 0,
    totalMonthlyWaste: 0,
    missingCoverage: ['disability'],
    missingUrgency: 'high',
    flags: [
      { code: 'disability_recommended', urgency: 'high', label: '╫æ╫Ö╫ÿ╫ò╫ù ╫É╫¢"╫ó ╫₧╫ò╫₧╫£╫Ñ ╫£╫⌐╫¢╫Ö╫¿╫Ö╫¥' },
    ],
    savings: { monthlyEstimate: 0, annualEstimate: 0 },
    hasCriticalGap: true,
  },
  recommendations: [
    {
      type: 'missing_disability',
      title: '╫¢╫Ö╫í╫ò╫Ö ╫ù╫í╫¿ ΓÇö ╫æ╫Ö╫ÿ╫ò╫ù ╫É╫¢"╫ó',
      reason: '╫É╫Ö╫ƒ ╫£╫Ü ╫æ╫Ö╫ÿ╫ò╫ù ╫É╫ò╫æ╫ô╫ƒ ╫¢╫ò╫⌐╫¿ ╫ó╫æ╫ò╫ô╫ö. ╫ó╫ò╫æ╫ô ╫⌐╫¢╫Ö╫¿ ╫£╫£╫É ╫æ╫Ö╫ÿ╫ò╫ù ╫û╫ö ╫ù╫⌐╫ò╫ú ╫£╫É╫ò╫æ╫ô╫ƒ ╫ö╫¢╫á╫í╫ö ╫₧╫£╫É ╫æ╫₧╫º╫¿╫ö ╫⌐╫£ ╫₧╫ù╫£╫ö.',
      urgency: 'high',
      financialImpact: '╫ö╫¢╫á╫í╫ö ╫ù╫£╫ò╫ñ╫Ö╫¬ ╫⌐╫£ ╫ó╫ô 75% ╫₧╫ö╫⌐╫¢╫¿',
      confidenceScore: 92,
    },
    {
      type: 'life_insurance_review',
      title: '╫æ╫ô╫ò╫º ╫É╫¬ ╫í╫¢╫ò╫¥ ╫æ╫Ö╫ÿ╫ò╫ù ╫ö╫ù╫Ö╫Ö╫¥',
      reason: '╫æ╫ö╫¬╫ù╫⌐╫æ ╫æ╫⌐╫á╫Ö ╫Ö╫£╫ô╫Ö╫¥ ╫ò╫₧╫⌐╫¢╫á╫¬╫É, ╫ò╫ô╫É ╫⌐╫í╫¢╫ò╫¥ ╫ö╫æ╫Ö╫ÿ╫ò╫ù ╫₧╫¢╫í╫ö ╫£╫ñ╫ù╫ò╫¬ 10x ╫⌐╫¢╫¿ ╫⌐╫á╫¬╫Ö.',
      urgency: 'medium',
      financialImpact: null,
      confidenceScore: 78,
    },
  ],
  durationMs: 95,
  explanation: '╫û╫ò╫ö╫ö ╫ñ╫ó╫¿ ╫º╫¿╫Ö╫ÿ╫Ö ΓÇö ╫ù╫í╫¿ ╫æ╫Ö╫ÿ╫ò╫ù ╫É╫¢"╫ó. ╫⌐╫É╫¿ ╫ö╫¢╫Ö╫í╫ò╫Ö╫Ö╫¥ ╫ö╫æ╫Ö╫ÿ╫ò╫ù╫Ö╫Ö╫¥ ╫¬╫º╫Ö╫á╫Ö╫¥.',
};

// ΓöÇΓöÇ Pension mock ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

const MOCK_PENSION_AGENT_RESULT = {
  agentId: 'pension',
  status: 'success',
  message: null,
  data: {
    hasData: true,
    grossSalary: DEMO_USER.grossSalary,
    pensionEmployee: 1080,
    pensionEmployer: 1500,
    totalMonthlyContribution: 2580,
    currentAge: DEMO_USER.age,
    retirementAge: DEMO_USER.retirementAge,
    currentAccumulation: 185000,
    currentMgmtFee: 0.006, // 0.6% ΓÇö above average, room for improvement
    projection: {
      available: true,
      monthsToRetirement: (DEMO_USER.retirementAge - DEMO_USER.age) * 12,
      projectedAccumulation: 2840000,
      monthlyPensionEstimate: 8200,
      replacementRatio: 46,
      scenarios: {
        base: { label: '╫æ╫í╫Ö╫í╫Ö (5.5%, ╫ô╫₧╫Ö ╫á╫Ö╫ö╫ò╫£ 0.6%)', accumulation: 2840000, monthlyPension: 8200 },
        optimistic: { label: '╫É╫ò╫ñ╫ÿ╫Ö╫₧╫Ö╫í╫ÿ╫Ö (7%, ╫ô╫₧╫Ö ╫á╫Ö╫ö╫ò╫£ 0.2%)', accumulation: 3950000, monthlyPension: 11400 },
      },
      mgmtFeeSavings: { savingsByRetirement: 280000, additionalMonthlyPension: 1167 },
    },
  },
  recommendations: [
    {
      type: 'high_mgmt_fee',
      title: '╫ô╫₧╫Ö ╫á╫Ö╫ö╫ò╫£ ╫Æ╫æ╫ò╫ö╫Ö╫¥ ΓÇö 0.6% ╫₧╫ö╫ª╫æ╫Ö╫¿╫ö',
      reason: '╫ô╫₧╫Ö ╫ö╫á╫Ö╫ö╫ò╫£ ╫⌐╫£╫Ü ╫Æ╫æ╫ò╫ö╫Ö╫¥ ╫₧╫ö╫₧╫₧╫ò╫ª╫ó (0.3%). ╫⌐╫Ö╫á╫ò╫Ö ╫£╫º╫¿╫ƒ ╫û╫ò╫£╫ö ╫Ö╫ù╫í╫ò╫Ü Γé¬280,000 ╫ó╫ô ╫ö╫ñ╫¿╫Ö╫⌐╫ö.',
      urgency: 'high',
      financialImpact: '+Γé¬1,167/╫ù╫ò╫ô╫⌐ ╫£╫º╫ª╫æ╫ö',
      confidenceScore: 88,
    },
    {
      type: 'low_replacement_ratio',
      title: '╫Ö╫ù╫í ╫¬╫ù╫£╫ò╫ñ╫ö ╫á╫₧╫ò╫Ü ΓÇö 46%',
      reason: '╫ö╫º╫ª╫æ╫ö ╫ö╫ª╫ñ╫ò╫Ö╫ö ╫₧╫ö╫ò╫ò╫ö ╫¿╫º 46% ╫₧╫ö╫⌐╫¢╫¿ ╫ö╫á╫ò╫¢╫ù╫Ö. ╫ö╫₧╫ÿ╫¿╫ö ╫ö╫₧╫ò╫₧╫£╫ª╫¬ ╫ö╫Ö╫É 70%.',
      urgency: 'medium',
      financialImpact: '╫ñ╫ó╫¿ ╫⌐╫£ Γé¬4,400/╫ù╫ò╫ô╫⌐',
      confidenceScore: 85,
    },
    {
      type: 'increase_contribution',
      title: '╫⌐╫º╫ò╫£ ╫£╫ö╫Æ╫ô╫Ö╫£ ╫ö╫ñ╫¿╫⌐╫ö ╫æ-1%',
      reason: '╫ö╫Æ╫ô╫£╫¬ ╫ö╫ö╫ñ╫¿╫⌐╫ö ╫₧-6% ╫£-7% ╫¬╫ò╫í╫Ö╫ú Γé¬180 ╫£╫ù╫ò╫ô╫⌐ ╫ò╫¬╫ª╫æ╫ò╫¿ Γé¬320,000 ╫á╫ò╫í╫ñ╫Ö╫¥ ╫ó╫ô ╫ö╫ñ╫¿╫Ö╫⌐╫ö.',
      urgency: 'low',
      financialImpact: '+Γé¬320,000 ╫æ╫ª╫æ╫Ö╫¿╫ö',
      confidenceScore: 80,
    },
  ],
  durationMs: 110,
  explanation: '╫₧╫ª╫æ ╫ö╫ñ╫á╫í╫Ö╫ö ╫í╫æ╫Ö╫¿ ╫É╫Ü ╫Ö╫⌐ ╫₧╫º╫ò╫¥ ╫£╫⌐╫Ö╫ñ╫ò╫¿ ΓÇö ╫æ╫ó╫Ö╫º╫¿ ╫æ╫ô╫₧╫Ö ╫ö╫á╫Ö╫ö╫ò╫£.',
};

// ΓöÇΓöÇ Profile mock ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

const MOCK_PROFILE_AGENT_RESULT = {
  agentId: 'profile',
  status: 'success',
  message: null,
  data: {
    riskProfile: 'medium',
    riskScore: 55,
    priorities: ['pension_optimization', 'insurance_gap', 'emergency_fund'],
    profileCompletion: 80,
    summaryLabel: '╫ñ╫¿╫ò╫ñ╫Ö╫£ ╫ñ╫Ö╫á╫á╫í╫Ö ╫₧╫₧╫ò╫ª╫ó-╫Æ╫æ╫ò╫ö',
  },
  recommendations: [
    {
      type: 'emergency_fund',
      title: '╫º╫¿╫ƒ ╫ù╫Ö╫¿╫ò╫¥ ΓÇö 3 ╫ù╫ò╫ô╫⌐╫Ö ╫ö╫ò╫ª╫É╫ò╫¬',
      reason: '╫₧╫ò╫₧╫£╫Ñ ╫£╫⌐╫₧╫ò╫¿ 3-6 ╫ù╫ò╫ô╫⌐╫Ö ╫ö╫ò╫ª╫É╫ò╫¬ (Γé¬36,000-72,000) ╫æ╫ù╫Ö╫í╫¢╫ò╫ƒ ╫á╫û╫Ö╫£.',
      urgency: 'medium',
      financialImpact: null,
      confidenceScore: 82,
    },
  ],
  durationMs: 45,
  explanation: null,
};

// ΓöÇΓöÇ Orchestrator full mock ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

const MOCK_FULL_ANALYSIS_RESULT = {
  runId: 'demo_run_001',
  userId: 'demo',
  agents: {
    payslip: MOCK_PAYSLIP_AGENT_RESULT,
    insurance: MOCK_INSURANCE_AGENT_RESULT,
    pension: MOCK_PENSION_AGENT_RESULT,
    profile: MOCK_PROFILE_AGENT_RESULT,
  },
  recommendations: [
    { ...MOCK_INSURANCE_AGENT_RESULT.recommendations[0], agentId: 'insurance' },
    { ...MOCK_PENSION_AGENT_RESULT.recommendations[0], agentId: 'pension' },
    { ...MOCK_PENSION_AGENT_RESULT.recommendations[1], agentId: 'pension' },
    { ...MOCK_PROFILE_AGENT_RESULT.recommendations[0], agentId: 'profile' },
    { ...MOCK_PAYSLIP_AGENT_RESULT.recommendations[1], agentId: 'payslip' },
    { ...MOCK_INSURANCE_AGENT_RESULT.recommendations[1], agentId: 'insurance' },
    { ...MOCK_PENSION_AGENT_RESULT.recommendations[2], agentId: 'pension' },
    { ...MOCK_PAYSLIP_AGENT_RESULT.recommendations[0], agentId: 'payslip' },
  ],
  summary: `╫ö╫á╫Ö╫¬╫ò╫ù ╫ö╫ñ╫Ö╫á╫á╫í╫Ö ╫⌐╫£╫Ü ╫₧╫Æ╫£╫ö 3 ╫á╫ò╫⌐╫É╫Ö╫¥ ╫₧╫¿╫¢╫û╫Ö╫Ö╫¥ ╫£╫ÿ╫Ö╫ñ╫ò╫£: (1) **╫ñ╫ó╫¿ ╫º╫¿╫Ö╫ÿ╫Ö ╫æ╫æ╫Ö╫ÿ╫ò╫ù ╫É╫¢"╫ó** ΓÇö ╫É╫Ö╫ƒ ╫£╫Ü ╫¢╫Ö╫í╫ò╫Ö ╫£╫₧╫º╫¿╫ö ╫É╫ò╫æ╫ô╫ƒ ╫¢╫ò╫⌐╫¿ ╫ó╫æ╫ò╫ô╫ö; (2) **╫ô╫₧╫Ö ╫á╫Ö╫ö╫ò╫£ ╫Æ╫æ╫ò╫ö╫Ö╫¥ ╫æ╫ñ╫á╫í╫Ö╫ö** (0.6%) ΓÇö ╫₧╫ó╫æ╫¿ ╫£╫º╫¿╫ƒ ╫û╫ò╫£╫ö ╫Ö╫ù╫í╫ò╫Ü Γé¬1,167/╫ù╫ò╫ô╫⌐ ╫£╫º╫ª╫æ╫ö; (3) **╫Ö╫ù╫í ╫¬╫ù╫£╫ò╫ñ╫ö ╫á╫₧╫ò╫Ü** (46%) ΓÇö ╫₧╫ò╫₧╫£╫Ñ ╫£╫ö╫Æ╫ô╫Ö╫£ ╫ö╫ñ╫¿╫⌐╫ò╫¬. ╫ö╫ª╫ô ╫ö╫ù╫Ö╫ò╫æ╫Ö: ╫ö╫⌐╫¢╫¿ ╫⌐╫£╫Ü ╫æ╫₧╫Æ╫₧╫¬ ╫ó╫£╫Ö╫Ö╫ö ╫ò╫ó╫₧╫Ö╫ô╫ö ╫æ╫ù╫ò╫º ╫ñ╫á╫í╫Ö╫Ö╫¬ ╫ö╫ù╫ò╫æ╫ö.`,
  summarySource: 'demo',
  meta: {
    durationMs: 380,
    agentCount: 4,
    successCount: 4,
    isDemo: true,
  },
};

// ΓöÇΓöÇ Dashboard mock ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

const MOCK_DASHBOARD_SUMMARY = {
  scores: {
    overall: 62,
    payslip: 78,
    insurance: 45,
    pension: 60,
  },
  documents: { total: 6, completed: 6, failed: 0, pending: 0 },
  profile: {
    hasProfile: true,
    hasInsuranceData: true,
    hasPensionData: true,
    importedPolicies: 0,
  },
  warnings: [
    '╫ù╫í╫¿ ╫æ╫Ö╫ÿ╫ò╫ù ╫É╫¢"╫ó',
    '╫ô╫₧╫Ö ╫á╫Ö╫ö╫ò╫£ ╫ñ╫á╫í╫Ö╫ö ╫Æ╫æ╫ò╫ö╫Ö╫¥ (0.6%)',
    '╫Ö╫ù╫í ╫¬╫ù╫£╫ò╫ñ╫ö ╫á╫₧╫ò╫Ü ΓÇö 46%',
  ],
  topRecommendations: [
    { id: 'demo_1', title: '╫¢╫Ö╫í╫ò╫Ö ╫ù╫í╫¿ ΓÇö ╫æ╫Ö╫ÿ╫ò╫ù ╫É╫¢"╫ó', importance: 'critical', category: 'insurance' },
    { id: 'demo_2', title: '╫ô╫₧╫Ö ╫á╫Ö╫ö╫ò╫£ ╫Æ╫æ╫ò╫ö╫Ö╫¥ ΓÇö 0.6%', importance: 'high', category: 'pension' },
  ],
  isDemo: true,
};

// ΓöÇΓöÇ Pension analysis mock ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

const MOCK_PENSION_ANALYSIS = {
  summary: {
    hasData: true,
    grossSalary: DEMO_USER.grossSalary,
    pensionEmployee: 1080,
    pensionEmployer: 1500,
    totalMonthlyContribution: 2580,
    currentAge: DEMO_USER.age,
    retirementAge: DEMO_USER.retirementAge,
    currentAccumulation: 185000,
    currentMgmtFee: 0.006,
    fundCount: 2,
    hasStudyFund: true,
  },
  projection: MOCK_PENSION_AGENT_RESULT.data.projection,
  benchmark: {
    funds: [{
      fundId: 'demo_f1',
      fundName: 'מגדל מקיפה',
      provider: 'מגדל',
      matchedTrack: { id: 'migdal_comp_high', name: 'מגדל מקיפה', provider: 'מגדל', rank: 12 },
      matchConfidence: 85,
      marketRankPercentile: 72,
      rankLabel: 'above_average',
      feeVsMarket: 'above_market',
      potentialSavingsToRetirement: 42000,
    }],
    summary: {
      totalPotentialSavings: 42000,
      avgRankPercentile: 72,
      fundsAboveMarketFee: 1,
      riskMismatchCount: 0,
      belowAverageCount: 0,
      issuesCount: 1,
      recommendedRiskLevel: 'high',
    },
  },
  healthCheck: {
    score: 74,
    level: { level: 'good', label: 'פנסיה במצב טוב' },
    categories: [
      { id: 'deposits', label: 'הפקדות', score: 22, maxScore: 25, status: 'good', detail: 'הפקדה תקינה' },
      { id: 'fees', label: 'דמי ניהול', score: 15, maxScore: 25, status: 'warning', detail: '1 קרן מעל ממוצע השוק' },
      { id: 'riskTrack', label: 'מסלול סיכון', score: 25, maxScore: 25, status: 'good', detail: 'מתאים לגיל' },
      { id: 'structure', label: 'מבנה תיק', score: 12, maxScore: 25, status: 'warning', detail: 'ריבוי קרנות' },
    ],
    disclaimer: 'הציון מבוסס על נתוני הייבוא — אינו ייעוץ פנסיוני.',
  },
  recommendations: MOCK_PENSION_AGENT_RESULT.recommendations,
  isDemo: true,
};

// ΓöÇΓöÇ Insurance analysis mock ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

const MOCK_INSURANCE_ANALYSIS = {
  profile: MOCK_INSURANCE_AGENT_RESULT.data.profile,
  personal: { age: DEMO_USER.age, maritalStatus: DEMO_USER.maritalStatus, childrenCount: DEMO_USER.childrenCount },
  assets: { ownsApartment: true, ownsCar: true, hasMortgage: true },
  policies: [
    { id: 'demo_p1', type: 'life', provider: '╫ö╫¿╫É╫£', policyNumber: '1234567', monthlyPremium: 280, coverageAmount: 1000000, startDate: '2020-01-01', endDate: null, status: 'active' },
    { id: 'demo_p2', type: 'health', provider: '╫₧╫¢╫æ╫Ö', policyNumber: '7654321', monthlyPremium: 180, coverageAmount: null, startDate: '2019-06-01', endDate: null, status: 'active' },
    { id: 'demo_p3', type: 'apartment', provider: '╫É╫Ö╫Ö╫£╫ò╫ƒ', policyNumber: '9876543', monthlyPremium: 95, coverageAmount: 850000, startDate: '2021-03-01', endDate: null, status: 'active' },
  ],
  analysis: MOCK_INSURANCE_AGENT_RESULT.data,
  recommendations: MOCK_INSURANCE_AGENT_RESULT.recommendations,
  hasImportedPolicies: false,
  isDemo: true,
};

module.exports = {
  MOCK_FULL_ANALYSIS_RESULT,
  MOCK_DASHBOARD_SUMMARY,
  MOCK_PENSION_ANALYSIS,
  MOCK_INSURANCE_ANALYSIS,
  MOCK_PAYSLIP_AGENT_RESULT,
  MOCK_INSURANCE_AGENT_RESULT,
  MOCK_PENSION_AGENT_RESULT,
  MOCK_PROFILE_AGENT_RESULT,
  DEMO_USER,
};
