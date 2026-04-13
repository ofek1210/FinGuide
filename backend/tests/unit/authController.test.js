let mockGoogleVerifyIdToken;

jest.mock('../../models/User', () => ({
  findOne: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
}));
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(),
}));
jest.mock('google-auth-library', () => {
  mockGoogleVerifyIdToken = jest.fn();
  return {
    OAuth2Client: jest.fn().mockImplementation(() => ({
      verifyIdToken: mockGoogleVerifyIdToken,
    })),
  };
});
const jwt = require('jsonwebtoken');
const User = require('../../models/User');
const {
  register,
  getMe,
  googleLogin,
} = require('../../controllers/authController');

const resetUserModelMocks = () => {
  User.findOne.mockReset();
  User.findById.mockReset();
  User.create.mockReset();
};

const resetJwtMocks = () => {
  jwt.sign.mockReset();
};

describe('authController - register', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetUserModelMocks();
    resetJwtMocks();
  });

  const buildReqResNext = body => {
    const req = {
      method: 'POST',
      url: '/api/auth/register',
      body,
    };
    const res = {
      statusCode: 200,
      body: undefined,
      headers: {},
      status(code) {
        this.statusCode = code;
        return this;
      },
      append(name, value) {
        this.headers[name] = this.headers[name]
          ? `${this.headers[name]},${value}`
          : value;
        return this;
      },
      json(payload) {
        this.body = payload;
        return this;
      },
      _getJSONData() {
        return this.body;
      },
    };
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
      avatarUrl: null,
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

describe('authController - googleLogin', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetUserModelMocks();
    resetJwtMocks();
    mockGoogleVerifyIdToken.mockReset();
    process.env.GOOGLE_CLIENT_ID = 'google-client-id';
  });

  const buildReqRes = body => {
    const req = {
      method: 'POST',
      url: '/api/auth/google',
      body,
    };
    const res = {
      statusCode: 200,
      body: undefined,
      headers: {},
      status(code) {
        this.statusCode = code;
        return this;
      },
      append(name, value) {
        this.headers[name] = this.headers[name]
          ? `${this.headers[name]},${value}`
          : value;
        return this;
      },
      json(payload) {
        this.body = payload;
        return this;
      },
      _getJSONData() {
        return this.body;
      },
    };
    return { req, res };
  };

  it('should use the shared fallback when GOOGLE_CLIENT_ID is missing', async () => {
    delete process.env.GOOGLE_CLIENT_ID;
    mockGoogleVerifyIdToken.mockRejectedValue(new Error('invalid token'));

    const { req, res } = buildReqRes({ credential: 'fake-token' });

    await googleLogin(req, res);

    expect(res.statusCode).toBe(401);
    expect(res._getJSONData()).toEqual({
      success: false,
      message: 'Google credential לא תקף',
    });
  });

  it('should return 401 when Google payload is not verified', async () => {
    mockGoogleVerifyIdToken.mockResolvedValue({
      getPayload: () => ({
        sub: 'google-user-id',
        email: 'test@example.com',
        email_verified: false,
      }),
    });

    const { req, res } = buildReqRes({ credential: 'fake-token' });

    await googleLogin(req, res);

    expect(res.statusCode).toBe(401);
    expect(res._getJSONData()).toEqual({
      success: false,
      message: 'Google credential לא תקף',
    });
  });

  it('should link an existing account by email and return token', async () => {
    const existingUser = {
      _id: 'existing-user-id',
      name: 'Existing User',
      email: 'existing@example.com',
      googleId: undefined,
      save: jest.fn().mockResolvedValue(true),
    };

    mockGoogleVerifyIdToken.mockResolvedValue({
      getPayload: () => ({
        sub: 'google-user-id',
        email: 'existing@example.com',
        email_verified: true,
        name: 'Existing User',
      }),
    });
    User.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(existingUser);
    jwt.sign.mockReturnValue('jwt-from-google');

    const { req, res } = buildReqRes({ credential: 'valid-token' });

    await googleLogin(req, res);

    expect(existingUser.googleId).toBe('google-user-id');
    expect(existingUser.save).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect(res._getJSONData()).toEqual({
      success: true,
      data: {
        user: {
          id: 'existing-user-id',
          name: 'Existing User',
          email: 'existing@example.com',
          avatarUrl: null,
        },
        token: 'jwt-from-google',
      },
      message: 'התחברות בוצעה בהצלחה',
    });
  });

  it('should create a new user when no matching account exists', async () => {
    const createdUser = {
      _id: 'new-user-id',
      name: 'New User',
      email: 'new@example.com',
      googleId: 'google-new-id',
    };

    mockGoogleVerifyIdToken.mockResolvedValue({
      getPayload: () => ({
        sub: 'google-new-id',
        email: 'new@example.com',
        email_verified: true,
        name: 'New User',
      }),
    });
    User.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    User.create.mockResolvedValue(createdUser);
    jwt.sign.mockReturnValue('jwt-for-new-user');

    const { req, res } = buildReqRes({ credential: 'valid-token' });

    await googleLogin(req, res);

    expect(User.create).toHaveBeenCalledWith({
      name: 'New User',
      email: 'new@example.com',
      googleId: 'google-new-id',
      password: expect.any(String),
    });
    expect(res.statusCode).toBe(200);
    expect(res._getJSONData()).toEqual({
      success: true,
      data: {
        user: {
          id: 'new-user-id',
          name: 'New User',
          email: 'new@example.com',
          avatarUrl: null,
        },
        token: 'jwt-for-new-user',
      },
      message: 'התחברות בוצעה בהצלחה',
    });
  });
});

describe('authController - getMe', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetUserModelMocks();
    resetJwtMocks();
  });

  it('should return current user from req.user (set by protect middleware)', async () => {
    const userFromProtect = {
      _id: 'user-id-1',
      name: 'Test User',
      email: 'test@test.com',
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
    };

    const req = {
      method: 'GET',
      url: '/api/auth/me',
      user: userFromProtect,
    };
    const res = {
      statusCode: 200,
      body: undefined,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.body = payload;
        return this;
      },
      _getJSONData() {
        return this.body;
      },
    };

    await getMe(req, res);

    expect(User.findById).not.toHaveBeenCalled();
    const data = res._getJSONData();
    expect(res.statusCode).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.user.id).toBe('user-id-1');
    expect(data.data.user.name).toBe('Test User');
    expect(data.data.user.email).toBe('test@test.com');
  });
});
