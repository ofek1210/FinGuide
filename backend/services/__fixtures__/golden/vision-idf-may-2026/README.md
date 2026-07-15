# Vision golden — IDF May 2026

Source: `Paycheck May 2026.pdf` (anonymized copy in `input.pdf`, rendered `input.png`).

Key regression targets:
- `contributions.pension.employee` = 2112.62
- `contributions.pension.employer` = 4074.31 (השתתפות בקרן הפנסיה — not derived)
- `contributions.study_fund.employee` / `employer` split

Run: `npx jest tests/unit/payslipVisionExtractor.golden.test.js -t "vision-idf-may"`
