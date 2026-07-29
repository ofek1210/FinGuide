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

  /**
   * מקור המחירים מוצג למשתמש — ולכן חייב להיות בעברית ומדויק.
   * אין מאגר ממשלתי של פרמיות לצרכן (data.gov.il מפרסם דוחות חברות
   * בלבד: ביטוח-נט, פנסיה-נט, גמל-נט ומדד שירות), ולכן הנתון כאן הוא
   * טווח הערכה מדגמי — לא ממוצע שוק נמדד.
   */
  sourceMetadata: {
    sourceName: process.env.INSURANCE_PRICING_SOURCE_NAME
      || 'טווח מחירים מדגמי של FinGuide',
    sourceDate: process.env.INSURANCE_PRICING_SOURCE_DATE || '2026-07-06',
    sourceUrl: process.env.INSURANCE_PRICING_SOURCE_URL || null,
    dataCollectionMethod: process.env.INSURANCE_PRICING_COLLECTION_METHOD
      || 'הערכה מדגמית לפי גיל, סוג כיסוי ורמת כיסוי — לא נאספה מחברות הביטוח ואינה ממוצע שוק נמדד',
  },

  disclaimerHe:
    'הטווח המוצג הוא הערכה מדגמית ולא ממוצע שוק אמיתי — אין מאגר ציבורי של פרמיות ביטוח לצרכן. השתמשו בו להתמצאות בלבד, לא כתחליף להצעת מחיר.',

  disclaimerEn:
    'Prices are estimates based on sample datasets and are not official quotes.',
};
