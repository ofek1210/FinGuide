const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const createApp = require('../../app');
const Document = require('../../models/Document');

let app;
let mongoServer;

const registerAndGetAuth = async () => {
  const response = await request(app).post('/api/auth/register').send({
    name: 'Document User',
    email: `doc-${Date.now()}@test.com`,
    password: 'Test123',
  });

  return {
    token: response.body?.data?.token,
    userId: response.body?.data?.user?.id,
  };
};

describe('App behavior integration', () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();

    process.env.JWT_SECRET = 'test-secret';
    process.env.JWT_EXPIRE = '7d';
    process.env.MONGODB_URI = mongoUri;
    process.env.NODE_ENV = 'test';

    await mongoose.connect(mongoUri);
    app = createApp();
  });

  afterEach(async () => {
    const collections = mongoose.connection.collections;
    await Promise.all(
      Object.values(collections).map(collection => collection.deleteMany({}))
    );
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  it('returns JSON payload from global error handler', async () => {
    const res = await request(app).get('/api/__test/error');

    expect(res.statusCode).toBe(500);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('forced_test_error');
  });

  it('does not expose filePath in GET /api/documents/:id', async () => {
    const { token, userId } = await registerAndGetAuth();

    const createdDocument = await Document.create({
      user: userId,
      originalName: 'salary.pdf',
      filename: `salary-${Date.now()}.pdf`,
      filePath: '/tmp/secret-internal-path.pdf',
      fileSize: 1024,
      mimeType: 'application/pdf',
      status: 'pending',
    });

    const res = await request(app)
      .get(`/api/documents/${createdDocument._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data._id).toBe(createdDocument._id.toString());
    expect(res.body.data.filePath).toBeUndefined();
  });
});
