'use strict';

/**
 * Mock data for DEMO mode.
 * Returned by each agent when options.demo === true.
 * Represents a realistic Israeli user: age 35, married, 2 kids, salary ₪18,000.
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

// ── Payslip mock ────────────────────────────────────────────────────────────

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
      title: 'השכר שלך עלה ב-5.9% ב-6 חודשים האחרונים',
      reason: 'עלייה מ-₪17,000 ל-₪18,000 — מגמה חיובית.',
      urgency: 'low',
      financialImpact: '+₪12,000 לשנה',
      confidenceScore: 95,
    },
    {
      type: 'study_fund_optimization',
      title: 'קרן ההשתלמות — שקול להגדיל הפרשה',
      reason: 'מקסום קרן ההשתלמות פטור ממס על רווחים עד תקרה שנתית.',
      urgency: 'medium',
      financialImpact: 'חיסכון מס של עד ₪3,000/שנה',
      confidenceScore: 80,
    },
  ],
  durationMs: 120,
  explanation: 'תלושי השכר שלך מראים מגמת עלייה יציבה. הפרשות הפנסיה תקינות.',
};

// ── Insurance mock ──────────────────────────────────────────────────────────

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
      { code: 'disability_recommended', urgency: 'high', label: 'ביטוח אכ"ע מומלץ לשכירים' },
    ],
    savings: { monthlyEstimate: 0, annualEstimate: 0 },
    hasCriticalGap: true,
  },
  recommendations: [
    {
      type: 'missing_disability',
      title: 'כיסוי חסר — ביטוח אכ"ע',
      reason: 'אין לך ביטוח אובדן כושר עבודה. עובד שכיר ללא ביטוח זה חשוף לאובדן הכנסה מלא במקרה של מחלה.',
      urgency: 'high',
      financialImpact: 'הכנסה חלופית של עד 75% מהשכר',
      confidenceScore: 92,
    },
    {
      type: 'life_insurance_review',
      title: 'בדוק את סכום ביטוח החיים',
      reason: 'בהתחשב בשני ילדים ומשכנתא, ודא שסכום הביטוח מכסה לפחות 10x שכר שנתי.',
      urgency: 'medium',
      financialImpact: null,
      confidenceScore: 78,
    },
  ],
  durationMs: 95,
  explanation: 'זוהה פער קריטי — חסר ביטוח אכ"ע. שאר הכיסויים הביטוחיים תקינים.',
};

// ── Pension mock ────────────────────────────────────────────────────────────

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
    currentMgmtFee: 0.006, // 0.6% — above average, room for improvement
    projection: {
      available: true,
      monthsToRetirement: (DEMO_USER.retirementAge - DEMO_USER.age) * 12,
      projectedAccumulation: 2840000,
      monthlyPensionEstimate: 8200,
      replacementRatio: 46,
      scenarios: {
        base: { label: 'בסיסי (5.5%, דמי ניהול 0.6%)', accumulation: 2840000, monthlyPension: 8200 },
        optimistic: { label: 'אופטימיסטי (7%, דמי ניהול 0.2%)', accumulation: 3950000, monthlyPension: 11400 },
      },
      mgmtFeeSavings: { savingsByRetirement: 280000, additionalMonthlyPension: 1167 },
    },
  },
  recommendations: [
    {
      type: 'high_mgmt_fee',
      title: 'דמי ניהול גבוהים — 0.6% מהצבירה',
      reason: 'דמי הניהול שלך גבוהים מהממוצע (0.3%). שינוי לקרן זולה יחסוך ₪280,000 עד הפרישה.',
      urgency: 'high',
      financialImpact: '+₪1,167/חודש לקצבה',
      confidenceScore: 88,
    },
    {
      type: 'low_replacement_ratio',
      title: 'יחס תחלופה נמוך — 46%',
      reason: 'הקצבה הצפויה מהווה רק 46% מהשכר הנוכחי. המטרה המומלצת היא 70%.',
      urgency: 'medium',
      financialImpact: 'פער של ₪4,400/חודש',
      confidenceScore: 85,
    },
    {
      type: 'increase_contribution',
      title: 'שקול להגדיל הפרשה ב-1%',
      reason: 'הגדלת ההפרשה מ-6% ל-7% תוסיף ₪180 לחודש ותצבור ₪320,000 נוספים עד הפרישה.',
      urgency: 'low',
      financialImpact: '+₪320,000 בצבירה',
      confidenceScore: 80,
    },
  ],
  durationMs: 110,
  explanation: 'מצב הפנסיה סביר אך יש מקום לשיפור — בעיקר בדמי הניהול.',
};

// ── Profile mock ────────────────────────────────────────────────────────────

const MOCK_PROFILE_AGENT_RESULT = {
  agentId: 'profile',
  status: 'success',
  message: null,
  data: {
    riskProfile: 'medium',
    riskScore: 55,
    priorities: ['pension_optimization', 'insurance_gap', 'emergency_fund'],
    profileCompletion: 80,
    summaryLabel: 'פרופיל פיננסי ממוצע-גבוה',
  },
  recommendations: [
    {
      type: 'emergency_fund',
      title: 'קרן חירום — 3 חודשי הוצאות',
      reason: 'מומלץ לשמור 3-6 חודשי הוצאות (₪36,000-72,000) בחיסכון נזיל.',
      urgency: 'medium',
      financialImpact: null,
      confidenceScore: 82,
    },
  ],
  durationMs: 45,
  explanation: null,
};

// ── Orchestrator full mock ────────────────────────────────────────────────────

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
  summary: `הניתוח הפיננסי שלך מגלה 3 נושאים מרכזיים לטיפול: (1) **פער קריטי בביטוח אכ"ע** — אין לך כיסוי למקרה אובדן כושר עבודה; (2) **דמי ניהול גבוהים בפנסיה** (0.6%) — מעבר לקרן זולה יחסוך ₪1,167/חודש לקצבה; (3) **יחס תחלופה נמוך** (46%) — מומלץ להגדיל הפרשות. הצד החיובי: השכר שלך במגמת עלייה ועמידה בחוק פנסיית החובה.`,
  summarySource: 'demo',
  meta: {
    durationMs: 380,
    agentCount: 4,
    successCount: 4,
    isDemo: true,
  },
};

// ── Dashboard mock ────────────────────────────────────────────────────────────

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
    'חסר ביטוח אכ"ע',
    'דמי ניהול פנסיה גבוהים (0.6%)',
    'יחס תחלופה נמוך — 46%',
  ],
  topRecommendations: [
    { id: 'demo_1', title: 'כיסוי חסר — ביטוח אכ"ע', importance: 'critical', category: 'insurance' },
    { id: 'demo_2', title: 'דמי ניהול גבוהים — 0.6%', importance: 'high', category: 'pension' },
  ],
  isDemo: true,
};

// ── Pension analysis mock ────────────────────────────────────────────────────

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
  },
  projection: MOCK_PENSION_AGENT_RESULT.data.projection,
  recommendations: MOCK_PENSION_AGENT_RESULT.recommendations,
  isDemo: true,
};

// ── Insurance analysis mock ────────────────────────────────────────────────────

const MOCK_INSURANCE_ANALYSIS = {
  profile: MOCK_INSURANCE_AGENT_RESULT.data.profile,
  personal: { age: DEMO_USER.age, maritalStatus: DEMO_USER.maritalStatus, childrenCount: DEMO_USER.childrenCount },
  assets: { ownsApartment: true, ownsCar: true, hasMortgage: true },
  policies: [
    { id: 'demo_p1', type: 'life', provider: 'הראל', policyNumber: '1234567', monthlyPremium: 280, coverageAmount: 1000000, startDate: '2020-01-01', endDate: null, status: 'active' },
    { id: 'demo_p2', type: 'health', provider: 'מכבי', policyNumber: '7654321', monthlyPremium: 180, coverageAmount: null, startDate: '2019-06-01', endDate: null, status: 'active' },
    { id: 'demo_p3', type: 'apartment', provider: 'איילון', policyNumber: '9876543', monthlyPremium: 95, coverageAmount: 850000, startDate: '2021-03-01', endDate: null, status: 'active' },
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
