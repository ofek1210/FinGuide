const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

jest.mock('../../services/gmailService', () => {
  const actual = jest.requireActual('../../services/gmailService');
  return {
    ...actual,
    connectWithAuthorizationCode: jest.fn(),
    syncGmailPayslips: jest.fn(),
    disconnectGmail: jest.fn(),
    getGmailIntegrationStatus: jest.fn(),
  };
});

const createApp = require('../../app');
const {
  connectWithAuthorizationCode,
  syncGmailPayslips,
  disconnectGmail,
  getGmailIntegrationStatus,
} = require('../../services/gmailService');

let app;
let mongoServer;

const registerAndGetAuth = async () => {
  const response = await request(app).post('/api/auth/register').send({
    name: 'Gmail User',
    email: `gmail-${Date.now()}@test.com`,
    password: 'Test123',
  });

  return response.body?.data?.token;
};

describe('Gmail integration routes', () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();

    process.env.JWT_SECRET = 'test-secret';
    process.env.JWT_EXPIRE = '7d';
    process.env.MONGODB_URI = mongoUri;
    process.env.NODE_ENV = 'test';
    process.env.GOOGLE_CLIENT_SECRET = 'test-google-secret';

    await mongoose.connect(mongoUri);
    app = createApp();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('GET /api/integrations/gmail/status requires auth', async () => {
    const res = await request(app).get('/api/integrations/gmail/status');
    expect(res.status).toBe(401);
  });

  it('returns gmail status for authenticated user', async () => {
    const token = await registerAndGetAuth();
    getGmailIntegrationStatus.mockResolvedValue({
      connected: false,
      gmailEmail: null,
      importedCount: 0,
      recentImports: [],
      redirectUri: 'http://localhost:5173/integrations/email',
    });

    const res = await request(app)
      .get('/api/integrations/gmail/status')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.connected).toBe(false);
  });

  it('POST /api/integrations/gmail/connect returns auth URL', async () => {
    const token = await registerAndGetAuth();
    connectWithAuthorizationCode.mockResolvedValue({
      authUrl: 'https://accounts.google.com/o/oauth2/auth?test=1',
    });

    const res = await request(app)
      .post('/api/integrations/gmail/connect')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.data.authUrl).toContain('accounts.google.com');
  });

  it('POST /api/integrations/gmail/sync returns summary', async () => {
    const token = await registerAndGetAuth();
    syncGmailPayslips.mockResolvedValue({
      found: 8,
      imported: 5,
      skippedDuplicates: 3,
      failed: 0,
      documents: [],
    });

    const res = await request(app)
      .post('/api/integrations/gmail/sync')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      found: 8,
      imported: 5,
      skippedDuplicates: 3,
      failed: 0,
      documents: [],
    });
  });

  it('DELETE /api/integrations/gmail/disconnect clears connection', async () => {
    const token = await registerAndGetAuth();
    disconnectGmail.mockResolvedValue({ connected: false });

    const res = await request(app)
      .delete('/api/integrations/gmail/disconnect')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.connected).toBe(false);
  });
});
