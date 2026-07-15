'use strict';

/**
 * JSON Schema for Claude structured-output vision extraction.
 * Plain number/string types only (no nullable unions — Anthropic limit: 16 unions).
 * Missing amounts: model returns -1; missing text: "" (normalized to null downstream).
 *
 * @module schemas/payslipVisionSchema
 */

const PAYSLIP_VISION_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    confidence: {
      type: 'object',
      properties: {
        period: { type: 'number', description: '0-1 confidence for pay period' },
        salary: { type: 'number', description: '0-1 confidence for gross/net' },
        deductions: { type: 'number', description: '0-1 confidence for mandatory deductions' },
        contributions: { type: 'number', description: '0-1 confidence for pension/study amounts' },
        parties: { type: 'number', description: '0-1 confidence for names/ID' },
      },
      required: ['period', 'salary', 'deductions', 'contributions', 'parties'],
      additionalProperties: false,
    },
    period_month: {
      type: 'string',
      description: 'Pay month from title "תלוש שכר לחודש MM/YYYY" (e.g. 07/2026). NOT seniority/employment dates.',
    },
    gross_total: {
      type: 'number',
      description: 'Monthly gross: IDF uses "ברוטו לפנסיה" in metadata OR סה"כ תשלומים שוטפים current column.',
    },
    net_payable: {
      type: 'number',
      description: 'Net to bank: "שכר חודשי נטו" at bottom of payslip.',
    },
    mandatory_total: {
      type: 'number',
      description: 'Sum of mandatory deductions this month if stated, else -1.',
    },
    income_tax: { type: 'number', description: 'מס הכנסה from ניכויים שוטפים current column.' },
    national_insurance: { type: 'number', description: 'ביטוח לאומי from ניכויים שוטפים.' },
    health_insurance: { type: 'number', description: 'ביטוח בריאות ממלכתי from ניכויים שוטפים.' },
    pension_employee: {
      type: 'number',
      description: 'Employee pension: "ניכוי לקרן הפנסיה" in ניכויים שוטפים — CURRENT month (rightmost) amount.',
    },
    pension_employer: {
      type: 'number',
      description: 'Employer pension: IDF "השתתפות בקרן הפנסיה" in metadata table (top section).',
    },
    study_employee: {
      type: 'number',
      description: 'Employee study fund: "ניכוי/נכוי לקרן השתלמות" in ניכויים שוטפים — current month.',
    },
    study_employer: {
      type: 'number',
      description: 'Employer study fund: IDF "השתתפות בקרן ההשתלמות" in metadata table.',
    },
    employer_name: { type: 'string', description: 'Employer e.g. צבא הגנה לישראל' },
    employee_name: { type: 'string', description: 'Employee full name from header' },
    employee_id: { type: 'string', description: 'Israeli ID ת.ז. digits only' },
    tax_credit_points: {
      type: 'number',
      description: 'Tax credit points (נקודות זיכוי / סך נקודות זיכוי / מספר נקודות זיכוי) — typically 2.25 for resident male. Return -1 if not visible.',
    },
  },
  required: [
    'confidence',
    'period_month',
    'gross_total',
    'net_payable',
    'mandatory_total',
    'income_tax',
    'national_insurance',
    'health_insurance',
    'pension_employee',
    'pension_employer',
    'study_employee',
    'study_employer',
    'employer_name',
    'employee_name',
    'employee_id',
    'tax_credit_points',
  ],
  additionalProperties: false,
};

module.exports = {
  PAYSLIP_VISION_RESPONSE_SCHEMA,
};
