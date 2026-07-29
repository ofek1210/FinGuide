'use strict';

/**
 * Premium benchmarking dataset — DISABLED for Insurance Agent recommendations.
 * Local CSV averages cannot account for underwriting variables; the agent uses
 * service-index / portfolio signals only. Functions return null/empty so leftover
 * imports stay safe. CSV files under data/insurance/ may remain on disk unused.
 */

function clearPricingCache() {}

function getSourceMetadata() {
  return null;
}

function getPricingDisclaimer() {
  return {
    he: 'השוואת פרמיות לממוצע שוק הוסרה מהסוכן.',
    en: 'Premium vs market benchmarking has been removed from the Insurance Agent.',
  };
}

function getFairPriceRange() {
  return null;
}

function compareUserPremium() {
  return {
    fairRange: null,
    assessment: 'unavailable',
    monthlyDeltaVsAvg: null,
    annualDeltaVsAvg: null,
    premiumVsMarket: null,
  };
}

function buildPricingComparisons() {
  return [];
}

module.exports = {
  clearPricingCache,
  getSourceMetadata,
  getPricingDisclaimer,
  getFairPriceRange,
  compareUserPremium,
  buildPricingComparisons,
};
