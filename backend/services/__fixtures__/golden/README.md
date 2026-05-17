# Payslip OCR — Golden Fixture Set

Ground-truth corpus used by `npm run eval:ocr` to measure per-field extraction accuracy.

## Layout

```
__fixtures__/golden/
├── README.md                       (this file)
├── _template/expected.json         (schema reference; not run by eval)
└── <fixture-name>/                 (one dir per payslip)
    ├── input.pdf                   (or input.jpg / input.png — what the OCR pipeline accepts)
    └── expected.json               (hand-verified ground truth)
```

Naming convention for `<fixture-name>`: `<vendor>-<yyyymm>[-<note>]` — e.g. `michpal-202410`, `hilan-202403-with-bonus`.

Anonymize all real payslips: blur ID numbers and names in the PDF *before* placing here. Update `expected.json` to match the anonymized values.

## `expected.json` shape

Focused on critical fields only. Every key is optional — omit a key if the value is ambiguous in the payslip or you're unsure. The eval skips missing keys (they don't penalize accuracy).

```json
{
  "period_month": "10/2025",          // string, "MM/YYYY" or "YYYY-MM"
  "gross_total": 18450.00,            // number, monthly gross
  "net_payable": 13127.45,            // number, final amount to bank
  "mandatory_total": 4709.80,         // number, sum of mandatory deductions
  "income_tax": 2841.30,              // number
  "national_insurance": 1305.50,      // number
  "health_insurance": 563.00,         // number
  "employee_id": "203848571"          // string, exact match
}
```

## Tolerances

| Field type        | Match rule                                       |
|-------------------|--------------------------------------------------|
| Numeric (amounts) | `abs(actual - expected) <= max(0.01, 0.005 * expected)` (≤0.5% drift) |
| `period_month`    | Normalized to `YYYY-MM` then exact match         |
| Strings (ID)      | Exact match after whitespace trim                |

## How eval runs

`npm run eval:ocr` walks every direct subdirectory of `__fixtures__/golden/` that contains both `input.*` and `expected.json`, runs the production OCR pipeline (`extractPayslipFile`), and prints:

- Per-field accuracy (% of fixtures that matched within tolerance).
- Confusion rows: when the wrong value was extracted, what value was produced instead.
- Aggregate `resolution_score` and `warnings` averages.

Eval never modifies fixtures or the database. Safe to run any time.

## Adding a fixture

1. `mkdir __fixtures__/golden/<vendor>-<yyyymm>`
2. Drop the anonymized payslip as `input.pdf` (or jpg/png).
3. Copy `_template/expected.json` and fill in only the fields you can verify by eye.
4. Run `npm run eval:ocr` — your fixture is now part of the regression baseline.
