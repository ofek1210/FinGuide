# Har HaKesef test fixtures

Synthetic anonymized samples mimicking pension clearing-house (הר הכסף / מסלקה) exports.

| File | Purpose |
|------|---------|
| `sample-report.xlsx` | Excel export with Hebrew headers |
| `sample-report-text.txt` | pdftotext-style layout for PDF parser tests |
| `sample-quarterly-report.txt` | Quarterly report (דוח תקופתי) layout from provider PDF |
| `expected.json` | Expected normalized parser output |

Column mapping (Excel header row):
- `חברה מנהלת` → provider
- `שם קרן` → fundName
- `סוג מוצר` → fundType (mapped to enum)
- `מספר חשבון` → accountNumber
- `יתרה/צבירה` → currentBalance
- `הפקדת עובד` / `הפקדת מעסיק` → monthly deposits
- `דמי ניהול מצבירה (%)` → managementFeeAccumulation (stored as fraction)
- `מסלול השקעה` → investmentTrack + riskLevel
