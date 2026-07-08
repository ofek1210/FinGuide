'use strict';

const path = require('path');

/**
 * Local-only insurance pricing benchmarks.
 * Do NOT call external health-insurance comparison APIs (CAPTCHA / bot protection).
 */
module.exports = {
  /** Always use bundled CSV/Excel — never scrape comparison sites */
  localOnly: process.env.INSURANCE_PRICING_LOCAL_ONLY !== 'false',

  dataDir: path.join(__dirname, '../data/insurance'),
  pricingCsvFile: process.env.INSURANCE_PRICING_CSV || 'pricing-benchmark.csv',
  pricingXlsxFile: process.env.INSURANCE_PRICING_XLSX || 'pricing-benchmark.xlsx',
  /** Manual exports from מחשבון בריאות — never auto-fetch */
  healthCalculatorSamplesDir: process.env.INSURANCE_HEALTH_SAMPLES_DIR
    || 'health-calculator-samples',
  /** Synthetic calculator-like samples, separated by insurance type */
  calculatorSampleDirs: (
    process.env.INSURANCE_CALCULATOR_SAMPLE_DIRS
      || 'car-calculator-samples,apartment-calculator-samples,life-calculator-samples,health-calculator-samples'
  ).split(',').map(dir => dir.trim()).filter(Boolean),

  sourceMetadata: {
    sourceName: process.env.INSURANCE_PRICING_SOURCE_NAME
      || 'FinGuide Synthetic Insurance Calculator Samples + Health Calculator Exports',
    sourceDate: process.env.INSURANCE_PRICING_SOURCE_DATE || '2026-07-06',
    sourceUrl: process.env.INSURANCE_PRICING_SOURCE_URL || null,
    dataCollectionMethod: process.env.INSURANCE_PRICING_COLLECTION_METHOD
      || 'Synthetic estimates based on realistic insurance pricing patterns and calculator-like parameters — not live insurer quotes',
  },

  disclaimerHe:
    'המחירים הם הערכות המבוססות על מדגם נתונים מקומי ואינם הצעות מחיר רשמיות מחברות הביטוח.',

  disclaimerEn:
    'Prices are estimates based on sample datasets and are not official quotes.',
};
