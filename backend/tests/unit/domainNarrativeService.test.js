

jest.mock('../../services/aiProviderService', () => ({
  analyzeWithAI: jest.fn().mockResolvedValue(null),
}));

const { generateDomainNarrative, buildInsightFallbackNarrative } = require('../../services/domainNarrativeService');

describe('domainNarrativeService', () => {
  it('buildInsightFallbackNarrative joins insight titles', () => {
    const text = buildInsightFallbackNarrative([
      { title: 'A', recommendation: 'do A' },
      { title: 'B', recommendation: 'do B' },
    ]);
    expect(text).toContain('A');
    expect(text).toContain('do B');
  });

  it('generateDomainNarrative falls back when LLM returns empty', async () => {
    const narrative = await generateDomainNarrative({
      systemPrompt: 'test',
      contextLines: ['line'],
      insights: [{ title: 'X', recommendation: 'Y' }],
    });
    expect(narrative).toContain('X');
  });
});
