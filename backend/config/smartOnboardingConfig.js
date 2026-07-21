'use strict';

/**
 * Smart onboarding question definitions.
 * Layer 1 = general (once at signup)
 * Layer 2 = agent-specific (first module visit, missing only)
 */

const GENERAL_QUESTIONS = [
  {
    id: 'general.age',
    layer: 'general',
    type: 'number',
    title: 'בן כמה אתה?',
    profilePath: 'personal.age',
    required: true,
  },
  {
    id: 'general.maritalStatus',
    layer: 'general',
    type: 'single',
    title: 'מה המצב המשפחתי שלך?',
    profilePath: 'personal.maritalStatus',
    options: [
      { value: 'single', label: 'רווק/ה' },
      { value: 'married', label: 'נשוי/אה' },
      { value: 'partnered', label: 'בזוגיות' },
      { value: 'divorced', label: 'גרוש/ה' },
      { value: 'widowed', label: 'אלמן/ה' },
    ],
    required: true,
  },
  {
    id: 'general.hasChildren',
    layer: 'general',
    type: 'yesno',
    title: 'יש לך ילדים?',
    profilePath: 'personal.hasChildren',
    required: true,
  },
  {
    id: 'general.employmentStatus',
    layer: 'general',
    type: 'single',
    title: 'מה סוג ההעסקה שלך?',
    profilePath: 'employment.employmentStatus',
    options: [
      { value: 'employee', label: 'שכיר/ה' },
      { value: 'self_employed', label: 'עצמאי/ת' },
      { value: 'both', label: 'גם וגם' },
    ],
    required: true,
  },
  {
    id: 'general.financialGoals',
    layer: 'general',
    type: 'multi',
    title: 'מה המטרות הפיננסיות שלך?',
    sub: 'אפשר לבחור כמה',
    profilePath: 'financial.financialGoals',
    options: [
      { value: 'improve_retirement', label: 'לשפר את הפנסיה' },
      { value: 'increase_savings', label: 'להגדיל חיסכון' },
      { value: 'reduce_fees', label: 'להוריד דמי ניהול' },
      { value: 'optimize_insurance', label: 'לייעל ביטוחים' },
      { value: 'improve_investments', label: 'לשפר השקעות' },
      { value: 'understand_finances', label: 'להבין טוב יותר את המצב הפיננסי' },
    ],
    required: true,
  },
  {
    id: 'general.investmentExperience',
    layer: 'general',
    type: 'single',
    title: 'מה ניסיון ההשקעות שלך?',
    profilePath: 'financial.investmentExperience',
    options: [
      { value: 'none', label: 'אין' },
      { value: 'beginner', label: 'מתחיל/ה' },
      { value: 'intermediate', label: 'בינוני' },
      { value: 'advanced', label: 'מתקדם/ת' },
    ],
    required: true,
  },
  {
    id: 'general.riskTolerance',
    layer: 'general',
    type: 'single',
    title: 'מה רמת הסיכון שמתאימה לך?',
    profilePath: 'financial.riskTolerance',
    options: [
      { value: 'low', label: 'נמוכה' },
      { value: 'medium', label: 'בינונית' },
      { value: 'high', label: 'גבוהה' },
    ],
    required: true,
  },
];

const AGENT_QUESTIONS = {
  payslip: [
    {
      id: 'payslip.onlyEmployer',
      type: 'yesno',
      title: 'האם זה המעסיק היחיד שלך?',
      profilePath: 'employment.isPrimaryJob',
      invertYesNo: true,
    },
    {
      id: 'payslip.hasVariablePay',
      type: 'yesno',
      title: 'האם אתה מקבל בונוסים, עמלות או שעות נוספות?',
    },
    {
      id: 'payslip.hasCompanyCar',
      type: 'yesno',
      title: 'האם יש לך רכב חברה?',
    },
    {
      id: 'payslip.hasEmployeeBenefits',
      type: 'single',
      title: 'האם אתה מקבל הטבות נוספות מהמעסיק?',
      options: [
        { value: 'yes', label: 'כן' },
        { value: 'no', label: 'לא' },
        { value: 'not_sure', label: 'לא בטוח/ה' },
      ],
    },
    {
      id: 'payslip.analysisFocus',
      type: 'single',
      title: 'על מה תרצה שנתמקד?',
      options: [
        { value: 'verify_payslip', label: 'לאמת את התלוש' },
        { value: 'employee_rights', label: 'למצוא זכויות עובד חסרות' },
        { value: 'tax_savings', label: 'למצוא חיסכון במס' },
        { value: 'everything', label: 'הכל' },
      ],
    },
  ],
  insurance: [
    {
      id: 'insurance.priority',
      type: 'single',
      title: 'מה הכי חשוב לך?',
      options: [
        { value: 'lower_costs', label: 'להוריד עלויות ביטוח' },
        { value: 'missing_coverage', label: 'לבדוק כיסוי חסר' },
        { value: 'duplicate_insurance', label: 'לזהות כפילויות' },
        { value: 'everything', label: 'הכל' },
      ],
    },
    {
      id: 'insurance.hasDependents',
      type: 'yesno',
      title: 'האם יש מישהו שתלוי בך כלכלית?',
      profilePath: 'personal.hasDependents',
    },
    {
      id: 'insurance.hasMortgage',
      type: 'yesno',
      title: 'האם יש לך משכנתא?',
      profilePath: 'assets.hasMortgage',
    },
    {
      id: 'insurance.wantCoverageRecommendations',
      type: 'yesno',
      title: 'אם נזהה כיסוי חסר — האם תרצה שנציג פוליסות לבדיקה?',
    },
  ],
  pension: [
    {
      id: 'pension.retirementAge',
      type: 'number',
      title: 'באיזה גיל תרצה לפרוש?',
      profilePath: 'retirement.plannedRetirementAge',
    },
    {
      id: 'pension.priority',
      type: 'single',
      title: 'מה חשוב לך יותר?',
      options: [
        { value: 'higher_income', label: 'קצבת פרישה גבוהה יותר' },
        { value: 'stability', label: 'יציבות' },
        { value: 'balanced', label: 'גישה מאוזנת' },
      ],
    },
    {
      id: 'pension.marketDeclineReaction',
      type: 'single',
      title: 'אם ההשקעות בפנסיה יירדו בכ-30% — מה תעשה?',
      options: [
        { value: 'stay_invested', label: 'אשאר מושקע/ת' },
        { value: 'not_sure', label: 'לא בטוח/ה' },
        { value: 'prefer_lower_risk', label: 'אעדיף/י סיכון נמוך יותר' },
      ],
    },
    {
      id: 'pension.insuranceInFundImportance',
      type: 'single',
      title: 'כמה חשוב לך לשמור על כיסוי הביטוחי בתוך קרן הפנסיה?',
      options: [
        { value: 'very_important', label: 'חשוב מאוד' },
        { value: 'somewhat_important', label: 'חשוב במידה מסוימת' },
        { value: 'not_sure', label: 'לא בטוח/ה' },
      ],
    },
  ],
  gemel: [
    {
      id: 'gemel.moneyPurpose',
      type: 'single',
      title: 'מה המטרה העיקרית של הכסף?',
      options: [
        { value: 'retirement', label: 'פרישה' },
        { value: 'home_purchase', label: 'רכישת דירה' },
        { value: 'general_savings', label: 'חיסכון כללי' },
        { value: 'children', label: 'ילדים' },
        { value: 'no_specific_goal', label: 'אין מטרה ספציפית' },
      ],
    },
    {
      id: 'gemel.liquidityHorizon',
      type: 'single',
      title: 'מתי צפוי שתצטרך/י את הכסף?',
      options: [
        { value: 'under_2_years', label: 'פחות משנתיים' },
        { value: '2_5_years', label: '2–5 שנים' },
        { value: '5_10_years', label: '5–10 שנים' },
        { value: 'over_10_years', label: 'יותר מ-10 שנים' },
      ],
    },
    {
      id: 'gemel.returnVsStability',
      type: 'single',
      title: 'מה חשוב לך יותר?',
      options: [
        { value: 'higher_returns', label: 'תשואה גבוהה יותר' },
        { value: 'stability', label: 'יציבות' },
        { value: 'balance', label: 'איזון' },
      ],
    },
    {
      id: 'gemel.lossReaction',
      type: 'single',
      title: 'אם ההשקעה תרד ב-25% — מה תעשה?',
      options: [
        { value: 'stay_invested', label: 'אשאר מושקע/ת' },
        { value: 'sell', label: 'אמכור' },
        { value: 'not_sure', label: 'לא בטוח/ה' },
      ],
    },
    {
      id: 'gemel.wantAlternatives',
      type: 'yesno',
      title: 'אם נזהה מסלולים שעשויים להתאים לך — להציג לך להשוואה?',
    },
  ],
};

const VALID_AGENTS = Object.keys(AGENT_QUESTIONS);

const ANSWER_SOURCES = ['user', 'onboarding', 'uploaded_document', 'pension_clearinghouse', 'inferred', 'imported'];

module.exports = {
  GENERAL_QUESTIONS,
  AGENT_QUESTIONS,
  VALID_AGENTS,
  ANSWER_SOURCES,
};
