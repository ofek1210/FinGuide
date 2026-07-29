/**
 * Premium price-range helpers — DISABLED.
 * Insurance Agent no longer estimates fair market premiums (underwriting variables
 * make local CSV benchmarks unreliable). Kept as a null-returning stub so legacy
 * imports do not crash; do not use for recommendations.
 */

function getPriceRange() {
  return null;
}

function getLegacyPriceRange() {
  return null;
}

function getSourceMetadata() {
  return null;
}

function getPricingDisclaimer() {
  return 'הערכת פרמיה מול שוק הוסרה — אינה אמינה ללא חיתום מלא.';
}

module.exports = {
  BASE: {},
  getPriceRange,
  getLegacyPriceRange,
  ageMultiplier: () => 1,
  salaryMultiplier: () => 1,
  getSourceMetadata,
  getPricingDisclaimer,
};
