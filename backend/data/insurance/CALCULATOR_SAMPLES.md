# Synthetic Insurance Calculator Samples

This folder contains local calculator-like insurance sample datasets for FinGuide.

These values are synthetic estimates based on realistic insurance pricing patterns and calculator-like parameters. They were not collected from official calculators, insurer websites, or live quotation systems, and they must not be treated as real insurance quotes.

Sample folders:

- `car-calculator-samples/`
- `apartment-calculator-samples/`
- `life-calculator-samples/`
- `health-calculator-samples/`

Each synthetic sample folder contains JSON and CSV files for that insurance type. The health folder also contains the existing manual health calculator Excel exports.

The synthetic calculator samples cover representative ages for each pricing band:

- 18 for ages 18-29
- 30 for ages 30-39
- 40 for ages 40-49
- 55 for ages 50-59
- 70 for ages 60+

The app loads these local files through `services/insuranceCalculatorSampleImport.js`, aggregates them into pricing benchmark rows, and merges them in `services/insurancePricingDatasetService.js` with the existing `pricing-benchmark.csv` and health calculator exports.

Regenerate the synthetic sample files:

```bash
npm run generate:insurance-samples --prefix backend
```
