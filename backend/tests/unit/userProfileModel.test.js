const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const UserProfile = require('../../models/UserProfile');

describe('UserProfile model', () => {
  let mongoServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterEach(async () => {
    await UserProfile.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  });

  it('creates a profile with empty sections by default', async () => {
    const userId = new mongoose.Types.ObjectId();
    const profile = await UserProfile.create({ user: userId });
    expect(profile.personal).toBeDefined();
    expect(profile.personal.age).toBeNull();
    expect(profile.retirement.investmentTypes).toEqual([]);
  });

  it('enforces unique user', async () => {
    const userId = new mongoose.Types.ObjectId();
    await UserProfile.create({ user: userId });
    await expect(UserProfile.create({ user: userId })).rejects.toThrow();
  });

  it('findOrCreateForUser returns existing or new', async () => {
    const userId = new mongoose.Types.ObjectId();
    const first = await UserProfile.findOrCreateForUser(userId);
    const second = await UserProfile.findOrCreateForUser(userId);
    expect(String(first._id)).toBe(String(second._id));
  });

  it('toLegacyOnboardingData flattens fields', async () => {
    const userId = new mongoose.Types.ObjectId();
    const profile = await UserProfile.create({
      user: userId,
      employment: { salaryType: 'global', expectedMonthlyGross: 21000, jobPercentage: 100 },
      retirement: { hasPension: true, hasStudyFund: false },
    });
    const flat = profile.toLegacyOnboardingData();
    expect(flat.salaryType).toBe('global');
    expect(flat.expectedMonthlyGross).toBe(21000);
    expect(flat.jobPercentage).toBe(100);
    expect(flat.hasPension).toBe(true);
    expect(flat.hasStudyFund).toBe(false);
    expect(flat.hourlyRate).toBeNull();
  });

  it('rejects invalid investment types', async () => {
    const userId = new mongoose.Types.ObjectId();
    const profile = new UserProfile({
      user: userId,
      retirement: { investmentTypes: ['stocks', 'banana'] },
    });
    await expect(profile.save()).rejects.toThrow();
  });

  it('respects min/max bounds on numeric fields', async () => {
    const userId = new mongoose.Types.ObjectId();
    const profile = new UserProfile({
      user: userId,
      personal: { age: 5 },
    });
    await expect(profile.save()).rejects.toThrow();
  });
});
