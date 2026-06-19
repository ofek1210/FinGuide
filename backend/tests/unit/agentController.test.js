/**
 * Unit tests for controllers/agentController.
 * Models, the agent orchestrator and the RAG/embeddings layer are mocked so
 * the controller's request handling is tested in isolation (no DB, no network).
 */

jest.mock('../../models/Document');
jest.mock('../../models/UserProfile');
jest.mock('../../models/Insight');
jest.mock('../../models/Recommendation');
jest.mock('../../services/agents', () => ({ orchestrate: jest.fn(), getAgentList: jest.fn() }));
jest.mock('../../services/embeddings', () => ({
  indexKnowledgeBase: jest.fn(),
  indexPayslipDocument: jest.fn(),
  getRAGStats: jest.fn(),
  isKnowledgeBaseIndexed: jest.fn(),
}));

const Document = require('../../models/Document');
const UserProfile = require('../../models/UserProfile');
const Insight = require('../../models/Insight');
const Recommendation = require('../../models/Recommendation');
const { orchestrate, getAgentList } = require('../../services/agents');
const embeddings = require('../../services/embeddings');
const controller = require('../../controllers/agentController');

function chain(result) {
  const c = {
    select: jest.fn(() => c),
    sort: jest.fn(() => c),
    limit: jest.fn(() => c),
    lean: jest.fn(() => Promise.resolve(result)),
  };
  return c;
}

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

const req = () => ({ body: {}, user: { _id: { toString: () => 'user-1' } } });

beforeEach(() => {
  jest.clearAllMocks();
  Document.find.mockReturnValue(chain([]));
  UserProfile.findOne.mockReturnValue(chain(null));
  Insight.find.mockReturnValue(chain([]));
  Recommendation.find.mockReturnValue(chain([]));
});

describe('askAgent', () => {
  it('returns 400 when the message is missing or blank', async () => {
    const res = mockRes();
    await controller.askAgent({ ...req(), body: { message: '   ' } }, res, jest.fn());
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(orchestrate).not.toHaveBeenCalled();
  });

  it('builds context, calls the orchestrator and returns its answer', async () => {
    orchestrate.mockResolvedValue({
      answer: 'תשובה',
      agent: 'pension_advisor',
      classification: 'pension_advisor',
      sources: [{ id: 's1' }],
      model: 'claude',
      tokensUsed: 42,
    });

    const res = mockRes();
    await controller.askAgent({ ...req(), body: { message: 'מה עם הפנסיה?' } }, res, jest.fn());

    expect(orchestrate).toHaveBeenCalledTimes(1);
    expect(res.body.success).toBe(true);
    expect(res.body.data.answer).toBe('תשובה');
    expect(res.body.data.agent).toBe('pension_advisor');
    expect(res.body.data.sources).toEqual([{ id: 's1' }]);
  });

  it('forwards unexpected errors to next()', async () => {
    orchestrate.mockRejectedValue(new Error('boom'));
    const next = jest.fn();
    await controller.askAgent({ ...req(), body: { message: 'שאלה' } }, mockRes(), next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

describe('listAgents', () => {
  it('returns the agent list from the orchestrator', () => {
    getAgentList.mockReturnValue([{ id: 'pension_advisor', name: 'x', description: 'y' }]);
    const res = mockRes();
    controller.listAgents(req(), res);
    expect(res.body.success).toBe(true);
    expect(res.body.data.agents).toHaveLength(1);
  });
});

describe('embedDocument', () => {
  it('returns 400 when documentId is missing', async () => {
    const res = mockRes();
    await controller.embedDocument(req(), res, jest.fn());
    expect(res.statusCode).toBe(400);
  });

  it('returns 404 when the document is not found', async () => {
    Document.findOne.mockReturnValue({ lean: () => Promise.resolve(null) });
    const res = mockRes();
    await controller.embedDocument({ ...req(), body: { documentId: 'd1' } }, res, jest.fn());
    expect(res.statusCode).toBe(404);
  });

  it('returns 400 when the document has no analysis data', async () => {
    Document.findOne.mockReturnValue({ lean: () => Promise.resolve({ _id: 'd1' }) });
    const res = mockRes();
    await controller.embedDocument({ ...req(), body: { documentId: 'd1' } }, res, jest.fn());
    expect(res.statusCode).toBe(400);
  });

  it('indexes a valid document and returns the result', async () => {
    Document.findOne.mockReturnValue({
      lean: () => Promise.resolve({ _id: 'd1', analysisData: { summary: { grossSalary: 1 } } }),
    });
    embeddings.indexPayslipDocument.mockResolvedValue({ indexed: 3 });
    const res = mockRes();
    await controller.embedDocument({ ...req(), body: { documentId: 'd1' } }, res, jest.fn());
    expect(res.body.data).toEqual({ indexed: 3 });
  });
});

describe('getRAGStatus', () => {
  it('returns store stats plus knowledgeBaseIndexed flag', () => {
    embeddings.getRAGStats.mockReturnValue({ totalChunks: 10, categories: { pension: 4 } });
    embeddings.isKnowledgeBaseIndexed.mockReturnValue(true);
    const res = mockRes();
    controller.getRAGStatus(req(), res);
    expect(res.body.data).toEqual({
      totalChunks: 10,
      categories: { pension: 4 },
      knowledgeBaseIndexed: true,
    });
  });
});

describe('indexKnowledge', () => {
  it('indexes the knowledge base and returns the result', async () => {
    embeddings.indexKnowledgeBase.mockResolvedValue({ indexed: 25, failed: 0 });
    const res = mockRes();
    await controller.indexKnowledge(req(), res, jest.fn());
    expect(res.body.data).toEqual({ indexed: 25, failed: 0 });
  });

  it('forwards errors to next()', async () => {
    embeddings.indexKnowledgeBase.mockRejectedValue(new Error('fail'));
    const next = jest.fn();
    await controller.indexKnowledge(req(), mockRes(), next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});
