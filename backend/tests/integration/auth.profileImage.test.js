const fs = require('fs/promises');
const path = require('path');
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const createApp = require('../../app');
const User = require('../../models/User');

const PROFILE_IMAGES_DIR = path.join(
  __dirname,
  '..',
  '..',
  'uploads',
  'profile-images'
);

const PNG_PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WnN0XcAAAAASUVORK5CYII=',
  'base64'
);

let app;
let mongoServer;

const registerAndGetToken = async () => {
  const response = await request(app).post('/api/auth/register').send({
    name: 'Avatar User',
    email: `avatar-${Date.now()}@test.com`,
    password: 'Test123',
  });

  return {
    token: response.body?.data?.token,
    userId: response.body?.data?.user?.id,
  };
};

const avatarPathFromUrl = avatarUrl =>
  path.join(PROFILE_IMAGES_DIR, path.basename(avatarUrl));

const removeProfileImages = async () => {
  const files = await fs.readdir(PROFILE_IMAGES_DIR).catch(() => []);
  await Promise.all(
    files.map(file => fs.unlink(path.join(PROFILE_IMAGES_DIR, file)).catch(() => {}))
  );
};

describe('Auth profile image flow', () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();

    process.env.JWT_SECRET = 'test-secret';
    process.env.JWT_EXPIRE = '7d';
    process.env.MONGODB_URI = mongoUri;
    process.env.NODE_ENV = 'test';

    await mongoose.connect(mongoUri);
    app = createApp();
  });

  afterEach(async () => {
    const collections = mongoose.connection.collections;
    await Promise.all(
      Object.values(collections).map(collection => collection.deleteMany({}))
    );
    await removeProfileImages();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  it('uploads a profile image, stores avatarUrl, and serves it statically', async () => {
    const { token, userId } = await registerAndGetToken();

    const response = await request(app)
      .post('/api/auth/profile/image')
      .set('Authorization', `Bearer ${token}`)
      .attach('avatar', PNG_PIXEL, {
        filename: 'avatar.png',
        contentType: 'image/png',
      });

    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data?.user?.avatarUrl).toMatch(
      /^\/uploads\/profile-images\/.+\.png$/
    );

    const user = await User.findById(userId);
    expect(user?.avatarUrl).toBe(response.body.data.user.avatarUrl);

    const avatarResponse = await request(app).get(response.body.data.user.avatarUrl);
    expect(avatarResponse.statusCode).toBe(200);
    expect(avatarResponse.headers['content-type']).toMatch(/^image\/png/);
  });

  it('replaces the previous avatar and deletes the old file', async () => {
    const { token, userId } = await registerAndGetToken();

    const firstResponse = await request(app)
      .post('/api/auth/profile/image')
      .set('Authorization', `Bearer ${token}`)
      .attach('avatar', PNG_PIXEL, {
        filename: 'avatar-first.png',
        contentType: 'image/png',
      });

    const firstAvatarUrl = firstResponse.body.data.user.avatarUrl;
    const firstAvatarPath = avatarPathFromUrl(firstAvatarUrl);

    const secondResponse = await request(app)
      .post('/api/auth/profile/image')
      .set('Authorization', `Bearer ${token}`)
      .attach('avatar', PNG_PIXEL, {
        filename: 'avatar-second.png',
        contentType: 'image/png',
      });

    const secondAvatarUrl = secondResponse.body.data.user.avatarUrl;
    const secondAvatarPath = avatarPathFromUrl(secondAvatarUrl);

    expect(secondResponse.statusCode).toBe(200);
    expect(secondAvatarUrl).not.toBe(firstAvatarUrl);

    const user = await User.findById(userId);
    expect(user?.avatarUrl).toBe(secondAvatarUrl);

    await expect(fs.access(firstAvatarPath)).rejects.toThrow();
    await expect(fs.access(secondAvatarPath)).resolves.toBeUndefined();
  });

  it('rejects invalid file types', async () => {
    const { token } = await registerAndGetToken();

    const response = await request(app)
      .post('/api/auth/profile/image')
      .set('Authorization', `Bearer ${token}`)
      .attach('avatar', Buffer.from('not-an-image'), {
        filename: 'avatar.txt',
        contentType: 'text/plain',
      });

    expect(response.statusCode).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it('requires authentication', async () => {
    const response = await request(app).post('/api/auth/profile/image');

    expect(response.statusCode).toBe(401);
    expect(response.body.success).toBe(false);
  });
});
