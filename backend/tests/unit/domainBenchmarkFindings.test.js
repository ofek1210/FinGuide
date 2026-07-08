

const { buildDomainBenchmarkFindings } = require('../../utils/domainBenchmarkFindings');

describe('domainBenchmarkFindings', () => {
  it('builds health-low and recommendation findings', () => {
    const analysis = {
      summary: { hasData: true, currentAge: 35 },
      healthCheck: { score: 40, level: { label: 'דורש טיפול' } },
      recommendations: [
        { type: 'fee_above_market', title: 'דמי ניהול גבוהים', urgency: 'high', reason: 'test' },
      ],
    };

    const findings = buildDomainBenchmarkFindings(analysis, {
      hasData: a => Boolean(a.summary?.hasData),
      healthLow: { id: 'pension_health_low', title: 'ציון נמוך', findingKind: 'pension_health_low' },
      fromRecommendations: {
        filter: rec => rec.type === 'fee_above_market',
        kindMap: { fee_above_market: 'fee_above_market' },
        meta: a => ({ currentAge: a.summary?.currentAge }),
      },
    });

    expect(findings.some(f => f.id === 'pension_health_low')).toBe(true);
    expect(findings.some(f => f.meta?.findingKind === 'fee_above_market')).toBe(true);
  });
});
