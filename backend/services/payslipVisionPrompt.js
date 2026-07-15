'use strict';

function buildPayslipVisionPrompt({ dualCrop = false } = {}) {
  const imageGuide = dualCrop
    ? `You receive TWO images from the same payslip page:
IMAGE 1 (top): metadata / "נתונים גולמיים" — read employer pension ("השתתפות בקרן הפנסיה"), employer study fund ("השתתפות בקרן ההשתלמות"), ברוטו לפנסיה, period header.
IMAGE 2 (bottom): payment tables — "תשלומים שוטפים", "ניכויים שוטפים", "שכר חודשי נטו".`
    : 'You receive ONE full-page payslip image.';

  return `You are an expert Israeli payroll (תלוש שכר) data extractor. ${imageGuide}

CRITICAL RULES:
1. NEVER guess or calculate unstated values. If not clearly visible, return -1 for numbers or "" for text.
2. Use ONLY the CURRENT MONTH column (נוכחי / rightmost amount). Ignore קודם / prior month / cumulative columns.
3. Dates like 01.06.26, 03/2034, seniority codes are NOT amounts — ignore them.
4. Hebrew payslips are RTL. Do not swap employee vs employer columns.
5. Set confidence per group 0–1. Use <0.6 when ambiguous.
6. Return -1 for missing numbers. Use 0 only when payslip explicitly shows zero.

FIELD LOCATIONS — IDF / צה"ל (צבא הגנה לישראל):
| Field | Where to read |
| period_month | Payslip TITLE only: "תלוש שכר לחודש MM/YYYY" at page top (e.g. 07/2026 = July). NEVER: ותק dates (01.06.26), תחילת עבודה, print date, seniority, or נתונים גולמיים row dates. |
| gross_total | Bottom "סה\"כ תשלומים שוטפים" CURRENT-month total row. If absent, metadata "ברוטו לפנסיה". NOT a single allowance line. |
| net_payable | Bottom line "שכר חודשי נטו" (typically 8,000–25,000 ₪) |
| income_tax | ניכויים שוטפים → "מס הכנסה" current column |
| national_insurance | ניכויים שוטפים → "ביטוח לאומי" current column |
| health_insurance | ניכויים שוטפים → "ביטוח בריאות ממלכתי" current column |
| pension_employee | ניכויים שוטפים → "ניכוי לקרן הפנסיה" / "נכוי לקרן פנסיה" — RIGHTMOST amount if two (e.g. 1647.03) |
| pension_employer | Metadata table → "השתתפות בקרן הפנסיה" amount ONLY (e.g. 3176.41) — NOT in ניכויים שוטפים |
| study_employee | ניכויים שוטפים → "ניכוי/נכוי לקרן השתלמות" — RIGHTMOST amount (e.g. 581.39) |
| study_employer | Metadata → "השתתפות בקרן ההשתלמות" (e.g. 1744.17) |
| tax_credit_points | Metadata / tax section → "סך נקודות זיכוי" / "מספר נקודות זיכוי" / "נקודות זיכוי" (e.g. 2.25). NOT cumulative annual credit amount. |

ANTI-PATTERNS (do NOT use these as amounts or period_month):
- Seniority dates (ותק, 01.06.26 suffixes glued to amounts)
- Small numbers < 50 from date fragments
- "נתונים גולמיים" row dates as period_month
- תחילת עבודה / employment start dates as period_month
- Single line items in תשלומים שוטפים as gross_total (gross is the TOTAL row or ברוטו לפנסיה)

STANDARD (non-IDF) PAYSLIPS:
- gross_total: סך תשלומים שוטף / ברוטו שוטף
- net_payable: סכום בבנק / לתשלום / שכר חודשי נטו
- pension_employee: ניכוי לקרן הפנסיה; pension_employer: הפרשת מעסיק / השתתפות

Return JSON matching the schema exactly.`;
}

module.exports = {
  buildPayslipVisionPrompt,
};
