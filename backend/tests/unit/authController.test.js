const httpMocks = require('node-mocks-http');
const jwt = require('jsonwebtoken');

const User = require('../../models/User');
const { register, login, getMe } = require('../../controllers/authController');

jest.mock('../../models/User');
jest.mock('jsonwebtoken');

describe('authController - register', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const buildReqResNext = body => {
    const req = httpMocks.createRequest({
      method: 'POST',
      url: '/api/auth/register',
      body,
    });
    const res = httpMocks.createResponse();
    const next = jest.fn();
    return { req, res, next };
  };

  it('should create a new user and return token on valid data', async () => {
    User.findOne.mockResolvedValue(null);
    const createdUser = {
      _id: 'user-id-1',
      name: 'Test User',
      email: 'test@test.com',
    };
    User.create.mockResolvedValue(createdUser);
    jwt.sign.mockReturnValue('test-token');

    const { req, res, next } = buildReqResNext({
      name: 'Test User',
      email: 'test@test.com',
      password: 'Test123',
    });

    await register(req, res, next);

    expect(User.findOne).toHaveBeenCalledWith({ email: 'test@test.com' });
    expect(User.create).toHaveBeenCalledWith({
      name: 'Test User',
      email: 'test@test.com',
      password: 'Test123',
    });
    const data = res._getJSONData();
    expect(res.statusCode).toBe(201);
    expect(data.success).toBe(true);
    expect(data.data.user).toEqual({
      id: 'user-id-1',
      name: 'Test User',
      email: 'test@test.com',
    });
    expect(data.data.token).toBe('test-token');
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 400 when user already exists', async () => {
    User.findOne.mockResolvedValue({ _id: 'exists' });

    const { req, res, next } = buildReqResNext({
      name: 'Test User',
      email: 'test@test.com',
      password: 'Test123',
    });

    await register(req, res, next);

    expect(res.statusCode).toBe(400);
    const data = res._getJSONData();
    expect(data.success).toBe(false);
    expect(data.message).toBe('משתמש עם אימייל זה כבר קיים');
    expect(next).not.toHaveBeenCalled();
  });

});

describe('authController - getMe', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return current user when exists', async () => {
    const req = httpMocks.createRequest({
      method: 'GET',
      url: '/api/auth/me',
      user: { id: 'user-id-1' },
    });
    const res = httpMocks.createResponse();
    const next = jest.fn();

    const userFromDb = {
      _id: 'user-id-1',
      name: 'Test User',
      email: 'test@test.com',
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
    };

    User.findById.mockResolvedValue(userFromDb);

    await getMe(req, res, next);

    expect(User.findById).toHaveBeenCalledWith('user-id-1');
    const data = res._getJSONData();
    expect(res.statusCode).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.user.id).toBe('user-id-1');
    expect(data.data.user.email).toBe('test@test.com');
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 404 when user not found', async () => {
    const req = httpMocks.createRequest({
      method: 'GET',
      url: '/api/auth/me',
      user: { id: 'missing-id' },
    });
    const res = httpMocks.createResponse();
    const next = jest.fn();

    User.findById.mockResolvedValue(null);

    await getMe(req, res, next);

    expect(res.statusCode).toBe(404);
    const data = res._getJSONData();
    expect(data.success).toBe(false);
    expect(data.message).toBe('משתמש לא נמצא');
    expect(next).not.toHaveBeenCalled();
  });

});

