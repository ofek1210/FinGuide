/**
 * Map pension recommendations to insight DTOs for risk-advice / email.
 */
'use strict';

const { recommendationsToInsights: mapRecs } = require('./insightMapper');

function recommendationsToInsights(recommendations) {
  return mapRecs(recommendations, 'pension');
}

module.exports = { recommendationsToInsights };
