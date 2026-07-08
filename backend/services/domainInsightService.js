

const {
  recommendationsToInsights,
  healthCategoriesToInsights,
  dedupeInsightsByTitle,
} = require('../utils/insightMapper');

/**
 * Shared insight pipeline: analysis → recs + health + extras → dedupe → narrative → meta.
 */
async function buildDomainInsights({
  userId,
  category,
  buildAnalysisFn,
  getExtraInsights,
  buildMeta,
  generateNarrative,
  insightLimit = 8,
}) {
  const analysis = await buildAnalysisFn(userId);

  const insightsFromRecs = recommendationsToInsights(analysis.recommendations, category);
  const healthInsights = healthCategoriesToInsights(analysis.healthCheck?.categories, category);
  const extraInsights = getExtraInsights ? getExtraInsights(analysis) : [];

  const insights = dedupeInsightsByTitle(
    [...insightsFromRecs, ...healthInsights, ...extraInsights],
    insightLimit,
  );

  const narrative = await generateNarrative(analysis, insights);
  const meta = buildMeta(analysis, insights);

  return { insights, narrative, meta };
}

module.exports = { buildDomainInsights };
