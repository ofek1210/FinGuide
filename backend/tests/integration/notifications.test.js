const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const createApp = require('../../app');
const Notification = require('../../models/Notification');

describe('Notifications integration', () => {
  let app;
  let mongoServer;
  let token;
  let userId;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    process.env.JWT_SECRET = 'test-secret';
    process.env.JWT_EXPIRE = '7d';
    process.env.MONGODB_URI = mongoServer.getUri();
    process.env.NODE_ENV = 'test';
    await mongoose.connect(mongoServer.getUri());
    app = createApp();
  });

  beforeEach(async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Notif User',
      email: `ntf-${Date.now()}-${Math.random()}@test.com`,
      password: 'Test123',
    });
    token = res.body.data.token;
    userId = res.body.data.user.id;
  });

  afterEach(async () => {
    await Promise.all(Object.values(mongoose.connection.collections).map(c => c.deleteMany({})));
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  });

  it('GET /api/notifications returns notifications with unread count', async () => {
    await Notification.create({
      user: userId,
      type: 'system',
      title: 'Test',
      body: 'Hello',
    });

    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.unreadCount).toBe(1);
    expect(res.body.data).toHaveLength(1);
  });

  it('POST /api/notifications/:id/read marks notification read', async () => {
    const n = await Notification.create({
      user: userId,
      type: 'system',
      title: 'Test',
      body: 'Hello',
    });
    const res = await request(app)
      .post(`/api/notifications/${n._id}/read`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.read).toBe(true);
  });

  it('POST /api/notifications/read-all marks all read', async () => {
    await Notification.create({ user: userId, type: 'system', title: 'A', body: '' });
    await Notification.create({ user: userId, type: 'system', title: 'B', body: '' });
    const res = await request(app)
      .post('/api/notifications/read-all')
      .set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
    const unread = await Notification.countDocuments({ user: userId, read: false });
    expect(unread).toBe(0);
  });
});
