# Vision golden — IDF June 2026

Source: `Paycheck Jun 2026 (1).pdf` (anonymized copy in `input.pdf`, rendered `input.png`).

Key regression targets (the original column-swap bug):
- `contributions.pension.employee` = **1647.03** (ניכוי לקרן הפנסיה — current month column)
- `contributions.pension.employer` = **3176.41** (השתתפות בקרן הפנסיה)
- `contributions.pension.participation_total` = 4823.44

Run: `npx jest tests/unit/payslipVisionExtractor.golden.test.js -t "vision-idf-june"`

