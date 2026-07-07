jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'תשובה מ-Claude' }],
        usage: { input_tokens: 10, output_tokens: 20 },
      }),
    },
  })));

describe('claudeChatService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv, ANTHROPIC_API_KEY: 'test-key', CHAT_PROVIDER: 'claude' };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('returns claude answer when API key is set', async () => {
    const { chat } = require('../../services/claudeChatService');
    const result = await chat('מה השכר שלי?', {
      userContext: { grossSalary: 20000, netSalary: 14000 },
      profile: null,
      insights: [],
      recommendations: [],
      history: [],
    });
    expect(result.answer).toBe('תשובה מ-Claude');
    expect(result.source).toBe('claude');
  });

  it('buildEnhancedSystemPrompt includes profile and insights', () => {
    const { buildEnhancedSystemPrompt } = require('../../services/claudeChatService');
    const prompt = buildEnhancedSystemPrompt(
      { grossSalary: 20000 },
      { personal: { age: 30 }, assets: { ownsCar: true } },
      [{ title: 'ירידה', description: 'שכר ירד' }],
      [{ title: 'ביטוח חיים', importance: 'high' }],
    );
    expect(prompt).toContain('גיל: 30');
    expect(prompt).toContain('ירידה');
    expect(prompt).toContain('ביטוח חיים');
  });
});
