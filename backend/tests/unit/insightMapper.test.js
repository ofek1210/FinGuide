'use strict';

const {
  recommendationsToInsights,
  healthCategoriesToInsights,
  dedupeInsightsByTitle,
  URGENCY_TO_SEVERITY,
} = require('../../utils/insightMapper');

describe('insightMapper', () => {
  it('recommendationsToInsights maps urgency to severity per category', () => {
    const pension = recommendationsToInsights([
      { type: 'fee_high', title: 'דמי ניהול', reason: 'גבוהים', urgency: 'high', financialImpact: '₪1000' },
    ], 'pension');
    expect(pension[0].category).toBe('pension');
    expect(pension[0].severity).toBe(URGENCY_TO_SEVERITY.high);

    const insurance = recommendationsToInsights([
      { type: 'dup', title: 'כפילות', reason: 'כפול', urgency: 'medium' },
    ], 'insurance');
    expect(insurance[0].category).toBe('insurance');
  });

  it('healthCategoriesToInsights maps non-good categories', () => {
    const insights = healthCategoriesToInsights([
      { id: 'fees', label: 'דמי ניהול', status: 'poor', detail: 'גבוה' },
      { id: 'coverage', label: 'כיסוי', status: 'good', detail: 'ok' },
    ], 'pension');
    expect(insights).toHaveLength(1);
    expect(insights[0].id).toBe('health_fees');
  });

  it('dedupeInsightsByTitle removes duplicates and caps limit', () => {
    const result = dedupeInsightsByTitle([
      { title: 'א', id: '1' },
      { title: 'ב', id: '2' },
      { title: 'א', id: '3' },
    ], 2);
    expect(result).toHaveLength(2);
    expect(result.map(i => i.title)).toEqual(['א', 'ב']);
  });
});
