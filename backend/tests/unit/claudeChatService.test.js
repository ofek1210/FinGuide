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
    jest.dontMock('../../services/aiService');
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

  it('buildEnhancedSystemPrompt includes profile, insights, and financial analysis', () => {
    const { buildEnhancedSystemPrompt } = require('../../services/claudeChatService');
    const prompt = buildEnhancedSystemPrompt(
      {
        grossSalary: 20000,
        netSalary: 14000,
        employerName: 'חברת דוגמה',
        payslipHistory: [{ date: '2026-05', grossSalary: 19000, netSalary: 13500 }],
        pensionAnalysis: {
          hasData: true,
          healthScore: 72,
          totalPotentialSavings: 120000,
          topRecs: ['הורדת דמי ניהול'],
        },
        insuranceAnalysis: {
          hasData: true,
          healthScore: 60,
          duplicateCount: 1,
          topRecs: ['לבטל כפילות בריאות'],
        },
      },
      { personal: { age: 30 }, assets: { ownsCar: true } },
      [{ title: 'ירידה', description: 'שכר ירד' }],
      [{ title: 'ביטוח חיים', importance: 'high' }],
    );
    expect(prompt).toContain('גיל: 30');
    expect(prompt).toContain('ירידה');
    expect(prompt).toContain('ביטוח חיים');
    expect(prompt).toContain('חברת דוגמה');
    expect(prompt).toContain('ציון בריאות פנסיונית: 72/100');
    expect(prompt).toContain('הורדת דמי ניהול');
    expect(prompt).toContain('כפילויות ביטוח: 1');
    expect(prompt).toContain('2026-05');
  });

  it('returns unavailable when Claude and Ollama both fail', async () => {
    process.env = { ...originalEnv, ANTHROPIC_API_KEY: '', CHAT_PROVIDER: 'claude' };
    jest.doMock('../../services/aiService', () => ({
      askLLM: jest.fn().mockResolvedValue(null),
    }));
    jest.resetModules();
    // Re-apply Anthropic mock after resetModules
    jest.doMock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({
      messages: { create: jest.fn() },
    })));

    const { chat } = require('../../services/claudeChatService');
    const result = await chat('שאלה כללית?', {
      userContext: {},
      profile: null,
      insights: [],
      recommendations: [],
      history: [],
    });
    expect(result.unavailable).toBe(true);
    expect(result.source).toBe('unavailable');
    expect(result.answer).toBeNull();
  });
});
