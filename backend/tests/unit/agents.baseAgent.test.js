/**
 * Unit tests for BaseAgent — the shared LLM-calling base class for every
 * specialist agent. Claude (@anthropic-ai/sdk) and Ollama (fetch) are mocked,
 * and the RAG retrieval layer is stubbed, so no network calls happen.
 */

jest.mock('../../services/embeddings/ragService', () => ({ retrieveContext: jest.fn() }));

const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () =>
  jest.fn().mockImplementation(() => ({ messages: { create: mockCreate } })),
);

const { retrieveContext } = require('../../services/embeddings/ragService');
const { BaseAgent } = require('../../services/agents/baseAgent');

const originalEnv = process.env;
const originalFetch = global.fetch;

function makeAgent() {
  return new BaseAgent({
    name: 'test_agent',
    description: 'agent under test',
    systemPrompt: 'אתה סוכן בדיקה.',
    ragCategory: 'tax',
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env = { ...originalEnv };
  retrieveContext.mockResolvedValue({
    context: 'מידע רלוונטי',
    sources: [{ id: 's1', score: 0.9 }],
  });
});

afterAll(() => {
  process.env = originalEnv;
  global.fetch = originalFetch;
});

describe('BaseAgent.run — Claude path', () => {
  it('returns the Claude answer with sources and summed token usage', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'תשובה מ-Claude' }],
      usage: { input_tokens: 5, output_tokens: 7 },
    });

    const result = await makeAgent().run('שאלה', {
      userContext: { grossSalary: 20000 },
      userId: 'u1',
    });

    expect(result.answer).toBe('תשובה מ-Claude');
    expect(result.agent).toBe('test_agent');
    expect(result.sources).toEqual([{ id: 's1', score: 0.9 }]);
    expect(result.tokensUsed).toBe(12);
    expect(result.model).toBeTruthy();
  });

  it('passes the retrieved RAG context into the Claude system prompt', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'ok' }],
      usage: { input_tokens: 1, output_tokens: 1 },
    });

    await makeAgent().run('שאלה', { userContext: { grossSalary: 20000 } });

    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.system).toContain('מידע רלוונטי');
    expect(callArgs.system).toContain('אתה סוכן בדיקה.');
  });
});

describe('BaseAgent.run — Ollama fallback', () => {
  it('falls back to Ollama when Claude throws', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    mockCreate.mockRejectedValue(new Error('claude down'));
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ message: { content: 'תשובה מ-Ollama' } }),
    });

    const result = await makeAgent().run('שאלה', {});
    expect(result.answer).toBe('תשובה מ-Ollama');
    expect(result.model).toMatch(/^ollama\//);
    expect(result.tokensUsed).toBeNull();
  });

  it('uses Ollama directly when no Anthropic key is configured', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ message: { content: 'בלי קלוד' } }),
    });

    const result = await makeAgent().run('שאלה', {});
    expect(result.answer).toBe('בלי קלוד');
    expect(mockCreate).not.toHaveBeenCalled();
  });
});

describe('BaseAgent.run — total failure', () => {
  it('returns the graceful "service unavailable" message when both LLMs fail', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    global.fetch = jest.fn().mockRejectedValue(new Error('ollama down'));

    const result = await makeAgent().run('שאלה', {});
    expect(result.answer).toContain('שירות ה-AI אינו זמין');
    expect(result.sources).toEqual([]);
    expect(result.model).toBeNull();
  });
});

describe('BaseAgent.buildFullPrompt / formatUserContext', () => {
  it('includes system prompt, RAG context, user data and the study disclaimer', () => {
    const prompt = makeAgent().buildFullPrompt(
      { grossSalary: 20000, netSalary: 14000 },
      'ידע מהמאגר',
    );
    expect(prompt).toContain('אתה סוכן בדיקה.');
    expect(prompt).toContain('ידע מהמאגר');
    expect(prompt).toContain('20000');
    expect(prompt).toContain('ייעוץ פיננסי מקצועי');
  });

  it('formatUserContext reports missing data clearly', () => {
    expect(makeAgent().formatUserContext(null)).toContain('אין נתוני משתמש');
    expect(makeAgent().formatUserContext({})).toContain('אין נתוני תלוש');
  });
});
