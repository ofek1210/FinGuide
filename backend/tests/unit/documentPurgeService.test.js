const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const Document = require('../../models/Document');
const Insight = require('../../models/Insight');
const Notification = require('../../models/Notification');
const { purgeUserDocuments } = require('../../services/documentPurgeService');
const vectorStore = require('../../services/embeddings/vectorStore');

describe('documentPurgeService', () => {
  let mongoServer;
  let userId;
  let uploadsDir;
  let filePath;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    userId = new mongoose.Types.ObjectId();
    uploadsDir = path.join(process.cwd(), 'uploads');
    await fs.promises.mkdir(uploadsDir, { recursive: true });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await Document.deleteMany({ user: userId });
    await Insight.deleteMany({ user: userId });
    await Notification.deleteMany({ user: userId });

    filePath = path.join(uploadsDir, `purge-test-${Date.now()}.pdf`);
    await fs.promises.writeFile(filePath, '%PDF-1.4 purge-test');
  });

  afterEach(async () => {
    await fs.promises.unlink(filePath).catch(() => {});
  });

  it('removes document, file, insights, notifications and RAG chunks', async () => {
    const doc = await Document.create({
      user: userId,
      originalName: 'ינואר 2025.pdf',
      filename: path.basename(filePath),
      filePath,
      fileSize: 20,
      mimeType: 'application/pdf',
      status: 'completed',
      metadata: { category: 'payslip', periodMonth: 1, periodYear: 2025 },
      analysisData: { period: { month: '2025-01' }, salary: { gross_total: 10000 } },
    });

    await Insight.create({
      user: userId,
      kind: 'salary_drop',
      title: 'ירידה',
      description: 'בדיקה',
      sourceDocumentIds: [doc._id],
    });
    await Notification.create({
      user: userId,
      type: 'document_processed',
      title: 'תלוש עובד',
      sourceType: 'document',
      sourceId: doc._id,
      link: `/payslip-history/${doc._id}`,
    });

    vectorStore.addChunk(`payslip_${doc._id}_income`, 'gross 10000', [0.1, 0.2], {
      documentId: String(doc._id),
      category: 'income',
    });

    const result = await purgeUserDocuments(userId, [doc]);
    expect(result.deletedCount).toBe(1);

    expect(await Document.findById(doc._id)).toBeNull();
    await expect(fs.promises.access(filePath)).rejects.toThrow();
    expect(await Insight.countDocuments({ user: userId })).toBe(0);
    expect(await Notification.countDocuments({ user: userId })).toBe(0);

    const leftover = vectorStore
      .search([0.1, 0.2], { topK: 100, minScore: -1 })
      .filter(c => String(c.metadata?.documentId || '') === String(doc._id));
    expect(leftover).toHaveLength(0);
  });
});
