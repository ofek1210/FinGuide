const Document = require('../models/Document');
const { getDocument } = require('../controllers/documentController');
const { NotFoundError } = require('../utils/appErrors');

jest.mock('../models/Document');

describe('document ownership', () => {
  test('scopes document access by user and returns 404 when not owned', async () => {
    Document.findOne = jest.fn().mockResolvedValue(null);

    const req = {
      params: { id: 'doc123' },
      user: { id: 'userB' },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();

    await getDocument(req, res, next);

    expect(Document.findOne).toHaveBeenCalledWith({
      _id: 'doc123',
      user: 'userB',
    });
    expect(next).toHaveBeenCalled();
    expect(next.mock.calls[0][0]).toBeInstanceOf(NotFoundError);
  });
});
