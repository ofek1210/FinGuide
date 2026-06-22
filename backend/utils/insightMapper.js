'use strict';

const URGENCY_TO_SEVERITY = {
  high: 'warning',
  medium: 'info',
  low: 'info',
};

function recommendationsToInsights(recommendations, category) {
  return (recommendations || []).map(rec => ({
    id: category === 'insurance'
      ? (rec.type || rec.code || rec.title)
      : rec.type,
    severity: URGENCY_TO_SEVERITY[rec.urgency] || 'info',
    category,
    title: rec.title,
    description: category === 'insurance'
      ? (rec.reason || rec.description || rec.title)
      : rec.reason,
    recommendation: category === 'insurance'
      ? (rec.reason || rec.financialImpact || rec.title)
      : (rec.financialImpact || rec.reason),
    financialImpact: null,
    financialImpactLabel: category === 'insurance'
      ? (rec.financialImpact || null)
      : rec.financialImpact,
  }));
}

function healthCategoriesToInsights(categories, category) {
  return (categories || [])
    .filter(c => c.status !== 'good')
    .map(c => ({
      id: `health_${c.id}`,
      severity: c.status === 'poor' ? 'warning' : 'info',
      category,
      title: c.label,
      description: c.detail,
      recommendation: c.detail,
      financialImpact: null,
      financialImpactLabel: null,
    }));
}

function dedupeInsightsByTitle(insights, limit = 8) {
  const seenTitles = new Set();
  return insights
    .filter(i => {
      if (seenTitles.has(i.title)) return false;
      seenTitles.add(i.title);
      return true;
    })
    .slice(0, limit);
}

module.exports = {
  URGENCY_TO_SEVERITY,
  recommendationsToInsights,
  healthCategoriesToInsights,
  dedupeInsightsByTitle,
};
