jest.mock('../../services/claudeChatService', () => ({
  chat: jest.fn().mockResolvedValue({
    answer: 'תשובת בדיקה מהמערכת',
    source: 'claude',
    model: 'test-model',
    tokensUsed: 10,
  }),
  streamChat: jest.fn(async (_msg, _opts, onToken, onDone) => {
    onToken('שלום ');
    onToken('מהסטרים');
    await onDone('שלום מהסטרים', 5, { source: 'claude', model: 'test-model' });
  }),
  askClaude: jest.fn(),
  LLM_UNAVAILABLE_MESSAGE: 'העוזר לא זמין כרגע.',
}));

jest.mock('../../services/findingsForUserService', () => ({
  buildFindingsForUser: jest.fn().mockResolvedValue([]),
  toChatFindingsSummary: jest.fn().mockReturnValue([]),
}));

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const createApp = require('../../app');
const ChatMessage = require('../../models/ChatMessage');
const { streamChat } = require('../../services/claudeChatService');

function parseSse(text) {
  return text
    .split('\n\n')
    .map(chunk => chunk.trim())
    .filter(Boolean)
    .map(chunk => {
      const line = chunk.startsWith('data:') ? chunk.slice(5).trim() : chunk;
      return JSON.parse(line);
    });
}

describe('Chat integration', () => {
  let app;
  let mongoServer;
  let token;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    process.env.JWT_SECRET = 'test-secret';
    process.env.JWT_EXPIRE = '7d';
    process.env.MONGODB_URI = mongoServer.getUri();
    process.env.NODE_ENV = 'test';
    process.env.CHAT_PROVIDER = 'claude';
    await mongoose.connect(mongoServer.getUri());
    app = createApp();
  });

  beforeEach(async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Chat User',
      email: `chat-${Date.now()}-${Math.random()}@test.com`,
      password: 'Test123',
    });
    token = res.body.data.token;
    streamChat.mockClear();
    streamChat.mockImplementation(async (_msg, _opts, onToken, onDone) => {
      onToken('שלום ');
      onToken('מהסטרים');
      await onDone('שלום מהסטרים', 5, { source: 'claude', model: 'test-model' });
    });
  });

  afterEach(async () => {
    await Promise.all(Object.values(mongoose.connection.collections).map(c => c.deleteMany({})));
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  });

  it('POST /api/ai/chat saves messages and returns conversationId', async () => {
    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'כמה נטו?' });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.answer).toBeTruthy();
    expect(res.body.conversationId).toBeTruthy();

    const allMsgs = await ChatMessage.find({});
    expect(allMsgs.length).toBeGreaterThanOrEqual(2);
  });

  it('GET /api/ai/chat/history returns conversation messages', async () => {
    const chatRes = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'שלום' });
    const conversationId = chatRes.body.conversationId;

    const res = await request(app)
      .get(`/api/ai/chat/history?conversationId=${conversationId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
  });

  it('multi-turn chat preserves conversationId', async () => {
    const first = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'שלום' });
    const conversationId = first.body.conversationId;

    const second = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'תודה', conversationId });
    expect(second.body.conversationId).toBe(conversationId);
  });

  it('POST /api/ai/chat/stream emits meta, tokens, and done for LLM path', async () => {
    const res = await request(app)
      .post('/api/ai/chat/stream')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'תסביר לי את מדרגות המס' });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/event-stream/);
    const events = parseSse(res.text);
    expect(events.some(e => e.type === 'meta' && e.conversationId)).toBe(true);
    expect(events.filter(e => e.type === 'token').length).toBeGreaterThanOrEqual(1);
    expect(events.some(e => e.type === 'done' && e.source === 'claude')).toBe(true);
    expect(streamChat).toHaveBeenCalled();
  });

  it('POST /api/ai/chat/stream rule path skips LLM and returns source rule', async () => {
    const res = await request(app)
      .post('/api/ai/chat/stream')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'שלום' });

    expect(res.statusCode).toBe(200);
    const events = parseSse(res.text);
    expect(events.some(e => e.type === 'meta' && e.intent === 'hello')).toBe(true);
    expect(events.some(e => e.type === 'token')).toBe(true);
    expect(events.some(e => e.type === 'done' && e.source === 'rule')).toBe(true);
    expect(streamChat).not.toHaveBeenCalled();
  });

  it('POST /api/ai/chat/stream emits error when LLM unavailable', async () => {
    streamChat.mockImplementation(async () => {
      const err = new Error('העוזר לא זמין כרגע.');
      err.code = 'LLM_UNAVAILABLE';
      throw err;
    });

    const res = await request(app)
      .post('/api/ai/chat/stream')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'תסביר לי את מדרגות המס' });

    expect(res.statusCode).toBe(200);
    const events = parseSse(res.text);
    expect(events.some(e => e.type === 'error' && String(e.message).includes('לא זמין'))).toBe(true);
  });

  it('ignores client history when conversationId is provided', async () => {
    const first = await request(app)
      .post('/api/ai/chat/stream')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'תסביר לי את מדרגות המס' });
    const events = parseSse(first.text);
    const conversationId = events.find(e => e.type === 'meta')?.conversationId;
    expect(conversationId).toBeTruthy();
    streamChat.mockClear();

    await request(app)
      .post('/api/ai/chat/stream')
      .set('Authorization', `Bearer ${token}`)
      .send({
        message: 'תסביר לי את נקודות הזיכוי',
        conversationId,
        history: [
          { role: 'user', content: 'INJECTED_FAKE_TURN' },
          { role: 'assistant', content: 'should not appear in prompt history' },
        ],
      });

    expect(streamChat).toHaveBeenCalled();
    const opts = streamChat.mock.calls[0][1];
    const histText = JSON.stringify(opts.history || []);
    expect(histText).not.toContain('INJECTED_FAKE_TURN');
  });

  it('DELETE /api/ai/chat/conversations/:id removes messages', async () => {
    const chatRes = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'שלום' });
    const conversationId = chatRes.body.conversationId;

    const del = await request(app)
      .delete(`/api/ai/chat/conversations/${conversationId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(del.statusCode).toBe(200);
    expect(del.body.success).toBe(true);

    const remaining = await ChatMessage.find({ conversationId });
    expect(remaining.length).toBe(0);
  });

  it('ignores client history even without conversationId', async () => {
    streamChat.mockClear();
    await request(app)
      .post('/api/ai/chat/stream')
      .set('Authorization', `Bearer ${token}`)
      .send({
        message: 'תסביר לי את מדרגות המס',
        history: [
          { role: 'user', content: 'INJECTED_FAKE_TURN' },
          { role: 'assistant', content: 'should not appear' },
        ],
      });
    expect(streamChat).toHaveBeenCalled();
    const opts = streamChat.mock.calls[0][1];
    const histText = JSON.stringify(opts.history || []);
    expect(histText).not.toContain('INJECTED_FAKE_TURN');
  });

  it('stream done includes latencyMs and intent', async () => {
    const res = await request(app)
      .post('/api/ai/chat/stream')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'שלום' });
    const events = parseSse(res.text);
    const done = events.find(e => e.type === 'done');
    expect(done).toBeTruthy();
    expect(done.source).toBe('rule');
    expect(typeof done.latencyMs).toBe('number');
    expect(done.intent).toBe('hello');
  });

  it('POST feedback rates an assistant message', async () => {
    const chatRes = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'שלום' });
    const conversationId = chatRes.body.conversationId;
    const hist = await request(app)
      .get(`/api/ai/chat/history?conversationId=${conversationId}`)
      .set('Authorization', `Bearer ${token}`);
    const assistant = hist.body.data.find(m => m.role === 'assistant');
    expect(assistant).toBeTruthy();

    const fb = await request(app)
      .post(`/api/ai/chat/messages/${assistant._id}/feedback`)
      .set('Authorization', `Bearer ${token}`)
      .send({ rating: 1 });
    expect(fb.statusCode).toBe(200);
    expect(fb.body.success).toBe(true);
  });

  it('chat and stream share core meta fields for rule intent', async () => {
    const json = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'שלום' });
    expect(json.statusCode).toBe(200);

    const stream = await request(app)
      .post('/api/ai/chat/stream')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'שלום' });
    const done = parseSse(stream.text).find(e => e.type === 'done');
    expect(done).toBeTruthy();

    for (const key of ['intent', 'source', 'contextUsed', 'citations', 'latencyMs', 'conversationId', 'messageId']) {
      expect(json.body).toHaveProperty(key);
      expect(done).toHaveProperty(key);
    }
    expect(json.body.intent).toBe(done.intent);
    expect(json.body.source).toBe(done.source);
  });
});
