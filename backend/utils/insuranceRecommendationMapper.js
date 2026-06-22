'use strict';

const { recommendationsToInsights: mapRecs } = require('./insightMapper');

function recommendationsToInsights(recommendations) {
  return mapRecs(recommendations, 'insurance');
}

module.exports = { recommendationsToInsights };
