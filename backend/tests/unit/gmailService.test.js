const { buildGmailSearchQuery, isDuplicateImport } = require('../../services/gmailService');

describe('gmailService helpers', () => {
  it('buildGmailSearchQuery includes payslip keywords and pdf filter', () => {
    const query = buildGmailSearchQuery();
    expect(query).toContain('has:attachment');
    expect(query).toContain('filename:pdf');
    expect(query).toContain('תלוש');
    expect(query).toContain('payslip');
    expect(query).toContain('106');
  });
});

describe('isDuplicateImport', () => {
  const mongoose = require('mongoose');
  const { MongoMemoryServer } = require('mongodb-memory-server');
  let mongoServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  afterEach(async () => {
    const Document = require('../../models/Document');
    await Document.deleteMany({});
  });

  it('detects duplicate by emailMetadata gmail ids', async () => {
    const Document = require('../../models/Document');
    const userId = new mongoose.Types.ObjectId();

    await Document.create({
      user: userId,
      originalName: 'payslip.pdf',
      filename: 'a.pdf',
      filePath: '/tmp/a.pdf',
      fileSize: 10,
      mimeType: 'application/pdf',
      source: 'gmail',
      emailMetadata: {
        gmailMessageId: 'msg-1',
        gmailAttachmentId: 'att-1',
      },
    });

    const duplicate = await isDuplicateImport(userId, {
      gmailMessageId: 'msg-1',
      gmailAttachmentId: 'att-1',
    });

    expect(duplicate).toBe(true);
  });
});
