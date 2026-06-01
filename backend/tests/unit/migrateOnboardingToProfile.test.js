const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const User = require('../../models/User');
const UserProfile = require('../../models/UserProfile');
const { runMigration } = require('../../scripts/migrateOnboardingToProfile');

describe('migrateOnboardingToProfile', () => {
  let mongoServer;
  let uri;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    uri = mongoServer.getUri();
    await mongoose.connect(uri);
  });

  afterEach(async () => {
    await User.deleteMany({});
    await UserProfile.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  });

  it('migrates legacy onboarding.data to UserProfile.employment/retirement', async () => {
    const user = await User.create({
      name: 'Legacy',
      email: 'legacy@test.com',
      password: 'Test123!',
      onboarding: {
        completed: true,
        completedAt: new Date('2024-01-15'),
        data: {
          salaryType: 'global',
          expectedMonthlyGross: 19500,
          jobPercentage: 100,
          isPrimaryJob: true,
          hasMultipleEmployers: false,
          employmentStartDate: '2019-01-01',
          hasPension: true,
          hasStudyFund: false,
        },
      },
    });

    const summary = await runMigration({ connectionString: uri });
    expect(summary.total).toBe(1);
    expect(summary.migrated).toBe(1);

    const profile = await UserProfile.findOne({ user: user._id });
    expect(profile).toBeTruthy();
    expect(profile.employment.salaryType).toBe('global');
    expect(profile.employment.expectedMonthlyGross).toBe(19500);
    expect(profile.retirement.hasPension).toBe(true);
    expect(profile.retirement.hasStudyFund).toBe(false);
    expect(profile.completedAt).toBeTruthy();
  });

  it('skips users with no legacy data', async () => {
    await User.create({
      name: 'Empty',
      email: 'empty@test.com',
      password: 'Test123!',
    });
    const summary = await runMigration({ connectionString: uri });
    expect(summary.skipped).toBe(1);
    expect(summary.migrated).toBe(0);
  });

  it('is idempotent (re-running does not duplicate)', async () => {
    await User.create({
      name: 'Re',
      email: 're@test.com',
      password: 'Test123!',
      onboarding: {
        completed: true,
        completedAt: new Date(),
        data: { salaryType: 'global', expectedMonthlyGross: 15000 },
      },
    });

    await runMigration({ connectionString: uri });
    const before = await UserProfile.countDocuments();
    await runMigration({ connectionString: uri });
    const after = await UserProfile.countDocuments();
    expect(after).toBe(before);
  });
});
