const fs = require('fs').promises;
const path = require('path');
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

jest.mock('../../services/documentProcessingService', () => ({
  processDocumentAsync: jest.fn(),
}));

const createApp = require('../../app');
const Document = require('../../models/Document');

let app;
let mongoServer;
let originalUploadEntries = [];

const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
const samplePdfPath = path.join(__dirname, '..', 'fixtures', 'sample.pdf');

const registerAndGetAuth = async () => {
  const response = await request(app).post('/api/auth/register').send({
    name: 'Upload User',
    email: `upload-${Date.now()}@test.com`,
    password: 'Test123',
  });

  return {
    token: response.body?.data?.token,
    userId: response.body?.data?.user?.id,
  };
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

describe('Document upload metadata integration', () => {
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

  it('stores file and metadata and returns public document payload', async () => {
    const { token } = await registerAndGetAuth();

    const res = await request(app)
      .post('/api/documents/upload')
      .set('Authorization', `Bearer ${token}`)
      .field('category', 'payslip')
      .field('periodMonth', '3')
      .field('periodYear', '2026')
      .field('documentDate', '2026-03-15')
      .attach('document', samplePdfPath);

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.originalName).toBe('sample.pdf');
    expect(res.body.data.status).toBe('pending');
    expect(res.body.data.metadata).toEqual({
      category: 'payslip',
      periodMonth: 3,
      periodYear: 2026,
      documentDate: expect.any(String),
      source: 'manual_upload',
    });
    expect(res.body.data.filePath).toBeUndefined();
    expect(res.body.data.filename).toBeUndefined();
    expect(res.body.data.checksumSha256).toBeUndefined();

    const createdDocument = await Document.findById(res.body.data._id);
    expect(createdDocument).toBeTruthy();
    expect(createdDocument.metadata.category).toBe('payslip');
    expect(createdDocument.status).toBe('pending');
    expect(createdDocument.checksumSha256).toHaveLength(64);

    const uploadEntries = await getUploadEntries();
    expect(uploadEntries.length).toBeGreaterThanOrEqual(originalUploadEntries.length + 1);
  });

  it('rejects invalid metadata and removes uploaded file', async () => {
    const { token } = await registerAndGetAuth();
    const beforeEntries = await getUploadEntries();

    const res = await request(app)
      .post('/api/documents/upload')
      .set('Authorization', `Bearer ${token}`)
      .field('periodMonth', '3')
      .attach('document', samplePdfPath);

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'category' }),
        expect.objectContaining({ field: 'periodYear' }),
      ])
    );

    expect(await Document.countDocuments()).toBe(0);
    expect(await getUploadEntries()).toEqual(beforeEntries);
  });

  it('lists and gets documents with metadata without exposing internal fields', async () => {
    const { token, userId } = await registerAndGetAuth();

    const createdDocument = await Document.create({
      user: userId,
      originalName: 'salary.pdf',
      filename: `salary-${Date.now()}.pdf`,
      filePath: '/tmp/secret-internal-path.pdf',
      fileSize: 1024,
      mimeType: 'application/pdf',
      status: 'pending',
      metadata: {
        category: 'invoice',
        periodMonth: 2,
        periodYear: 2026,
        source: 'manual_upload',
      },
      checksumSha256: 'a'.repeat(64),
    });

    const listRes = await request(app)
      .get('/api/documents')
      .set('Authorization', `Bearer ${token}`);

    expect(listRes.statusCode).toBe(200);
    expect(listRes.body.data[0].metadata.category).toBe('invoice');
    expect(listRes.body.data[0].filePath).toBeUndefined();

    const getRes = await request(app)
      .get(`/api/documents/${createdDocument._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(getRes.statusCode).toBe(200);
    expect(getRes.body.data.metadata.periodYear).toBe(2026);
    expect(getRes.body.data.filePath).toBeUndefined();
    expect(getRes.body.data.filename).toBeUndefined();
  });

  it('deletes both the record and the stored file', async () => {
    const { token } = await registerAndGetAuth();

    const uploadRes = await request(app)
      .post('/api/documents/upload')
      .set('Authorization', `Bearer ${token}`)
      .field('category', 'other')
      .attach('document', samplePdfPath);

    const createdDocument = await Document.findById(uploadRes.body.data._id);
    expect(createdDocument).toBeTruthy();

    const deleteRes = await request(app)
      .delete(`/api/documents/${createdDocument._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(deleteRes.statusCode).toBe(200);
    expect(await Document.findById(createdDocument._id)).toBeNull();
    await expect(fs.access(createdDocument.filePath)).rejects.toThrow();
  });
});
