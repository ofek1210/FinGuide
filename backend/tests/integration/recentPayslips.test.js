'use strict';

const fs = require('fs').promises;
const path = require('path');
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

jest.mock('../../services/documentProcessingService', () => ({
  processDocumentAsync: jest.fn(),
}));

jest.mock('../../services/payslipOcr', () => ({
  extractPayslipFile: jest.fn().mockResolvedValue({
    data: {
      period: { month: '2026-03' },
      salary: { gross_total: 10000, net_payable: 7500 },
      deductions: { mandatory: { total: 1200 } },
      summary: { grossSalary: 10000, netSalary: 7500, date: '2026-03' },
      quality: { warnings: [] },
    },
  }),
}));

const createApp = require('../../app');

const PAYSLIP_FIXTURE = path.join(__dirname, '../fixtures/sample.pdf');
const uploadsDir = path.join(__dirname, '..', '..', 'uploads');

let app;
let mongoServer;
let originalUploadEntries = [];

const registerAndGetAuth = async () => {
  const response = await request(app).post('/api/auth/register').send({
    name: 'Recent Payslips User',
    email: `recent-payslips-${Date.now()}@test.com`,
    password: 'Test123',
  });

  return { token: response.body?.data?.token };
};

const getUploadEntries = async () => {
  const entries = await fs.readdir(uploadsDir, { withFileTypes: true });
  return entries
    .filter(entry => entry.isFile())
    .map(entry => entry.name)
    .sort();
};

const cleanupNewUploadFiles = async () => {
  const currentEntries = await getUploadEntries();
  const currentSet = new Set(currentEntries);
  const originalSet = new Set(originalUploadEntries);

  await Promise.all(
    [...currentSet]
      .filter(entry => !originalSet.has(entry))
      .map(entry => fs.unlink(path.join(uploadsDir, entry)).catch(() => {}))
  );
};

describe('GET /api/documents/recent-payslips', () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();

    process.env.JWT_SECRET = 'test-secret';
    process.env.JWT_EXPIRE = '7d';
    process.env.MONGODB_URI = mongoUri;
    process.env.NODE_ENV = 'test';

    await mongoose.connect(mongoUri);
    app = createApp();
    originalUploadEntries = await getUploadEntries();
  });

  afterEach(async () => {
    const collections = mongoose.connection.collections;
    await Promise.all(
      Object.values(collections).map(collection => collection.deleteMany({}))
    );
    await cleanupNewUploadFiles();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  it('returns analyzable payslips after upload', async () => {
    const { token } = await registerAndGetAuth();

    const uploadRes = await request(app)
      .post('/api/documents/upload')
      .set('Authorization', `Bearer ${token}`)
      .field('category', 'payslip')
      .field('periodMonth', '3')
      .field('periodYear', '2026')
      .attach('document', PAYSLIP_FIXTURE);

    expect(uploadRes.statusCode).toBe(201);
    expect(uploadRes.body.data).toMatchObject({
      analyzable: expect.any(Boolean),
      uploadOutcome: expect.stringMatching(/^(analyzed|needs_password|failed)$/),
    });

    const recentRes = await request(app)
      .get('/api/documents/recent-payslips?limit=3')
      .set('Authorization', `Bearer ${token}`);

    expect(recentRes.statusCode).toBe(200);
    expect(recentRes.body.success).toBe(true);
    expect(Array.isArray(recentRes.body.data.documents)).toBe(true);
    expect(typeof recentRes.body.data.count).toBe('number');
    if (uploadRes.body.data.analyzable) {
      expect(recentRes.body.data.count).toBeGreaterThanOrEqual(1);
    }
  });
});
