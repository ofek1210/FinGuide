const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const createApp = require('../../app');

let app;
let mongoServer;

describe('Auth routes integration', () => {
  beforeAll(async () => {
    // Start in-memory Mongo server
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();

    // Set env vars required by the app
    process.env.JWT_SECRET = 'test-secret';
    process.env.JWT_EXPIRE = '7d';
    process.env.MONGODB_URI = mongoUri;
    process.env.NODE_ENV = 'test';

    // Connect mongoose
    await mongoose.connect(mongoUri);

    app = createApp();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  afterEach(async () => {
    // Cleanup users collection between tests
    const { collections } = mongoose.connection;
    const userCollection = collections.users;
    if (userCollection) {
      await userCollection.deleteMany({});
    }
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user with valid data', async () => {
      const res = await request(app).post('/api/auth/register').send({
        name: 'Test User',
        email: 'test@example.com',
        password: 'Test123',
      });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe('test@example.com');
      expect(res.body.data.token).toBeDefined();
    });

    it('should reject duplicate email', async () => {
      const payload = {
        name: 'Test User',
        email: 'dup@example.com',
        password: 'Test123',
      };

      await request(app).post('/api/auth/register').send(payload);
      const res = await request(app).post('/api/auth/register').send(payload);

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('משתמש עם אימייל זה כבר קיים');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login with correct credentials', async () => {
      const email = 'login@test.com';
      const password = 'Test123';

      await request(app).post('/api/auth/register').send({
        name: 'Login User',
        email,
        password,
      });

      const res = await request(app).post('/api/auth/login').send({
        email,
        password,
      });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
    });

    it('should return 401 for wrong password', async () => {
      const email = 'wrongpass@test.com';
      const password = 'Test123';

      await request(app).post('/api/auth/register').send({
        name: 'Wrong Pass User',
        email,
        password,
      });

      const res = await request(app).post('/api/auth/login').send({
        email,
        password: 'Wrong123',
      });

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('אימייל או סיסמה לא נכונים');
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return current user with valid token', async () => {
      const email = 'me@test.com';
      const password = 'Test123';

      const registerRes = await request(app).post('/api/auth/register').send({
        name: 'Me User',
        email,
        password,
      });

      const token = registerRes.body.data.token;

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe(email);
    });

    it('should return 401 when no token is provided', async () => {
      const res = await request(app).get('/api/auth/me');

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('לא מורשה, אין token');
    });
  });
});
