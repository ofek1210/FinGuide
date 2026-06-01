jest.mock('../../services/claudeChatService', () => ({
  chat: jest.fn().mockResolvedValue({
    answer: 'תשובת בדיקה מהמערכת',
    source: 'claude',
    model: 'test-model',
    tokensUsed: 10,
  }),
}));

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const createApp = require('../../app');
const ChatMessage = require('../../models/ChatMessage');

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
});
