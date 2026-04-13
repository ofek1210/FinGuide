jest.mock('../../services/aiService', () => ({
  checkAIAvailability: jest.fn(),
  generateAnswer: jest.fn(),
}));

const { chatWithAI, getAIStatus } = require('../../controllers/aiController');
const {
  checkAIAvailability,
  generateAnswer,
} = require('../../services/aiService');

const createResponse = () => {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };

  return res;
};

describe('aiController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns source for rule based responses', async () => {
    const req = {
      body: {
        message: 'תגיד לי שלום בעברית',
      },
    };
    const res = createResponse();

    await chatWithAI(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.source).toBe('rule');
  });

  it('returns source for model responses', async () => {
    checkAIAvailability.mockResolvedValue({
      available: true,
      provider: 'ollama',
    });
    generateAnswer.mockResolvedValue({
      answer: 'תשובה',
      source: 'llama3.2:1b',
    });

    const req = {
      body: {
        message: 'מה מצב המסמכים שלי?',
      },
    };
    const res = createResponse();

    await chatWithAI(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.source).toBe('llama3.2:1b');
  });

  it('returns 503 when provider is unavailable', async () => {
    checkAIAvailability.mockResolvedValue({
      available: false,
      provider: 'ollama',
      reason: 'connection_failed',
    });

    const req = {
      body: {
        message: 'תסכם לי את המסמכים',
      },
    };
    const res = createResponse();

    await chatWithAI(req, res);

    expect(res.statusCode).toBe(503);
    expect(res.body.success).toBe(false);
    expect(res.body.provider).toBe('ollama');
  });

  it('returns availability status payload', async () => {
    checkAIAvailability.mockResolvedValue({
      available: true,
      provider: 'ollama',
    });

    const res = createResponse();
    await getAIStatus({}, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: {
        available: true,
        provider: 'ollama',
      },
    });
  });
});
