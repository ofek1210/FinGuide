/* eslint-disable no-console */
/**
 * Migrates legacy User.onboarding.data into the new UserProfile collection.
 *
 * Idempotent: existing UserProfile documents are merged-with rather than
 * overwritten, so re-running the script is safe.
 *
 * Usage:
 *   node backend/scripts/migrateOnboardingToProfile.js
 */

const mongoose = require('mongoose');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const User = require('../models/User');
const UserProfile = require('../models/UserProfile');

const EMPLOYMENT_KEYS = [
  'salaryType',
  'expectedMonthlyGross',
  'hourlyRate',
  'expectedMonthlyHours',
  'jobPercentage',
  'isPrimaryJob',
  'hasMultipleEmployers',
  'employmentStartDate',
];

const RETIREMENT_KEYS = ['hasPension', 'hasStudyFund'];

const pickDefined = (source, keys) => {
  const out = {};
  keys.forEach(key => {
    const value = source?.[key];
    if (value !== undefined && value !== null) {
      out[key] = value;
    }
  });
  return out;
};

async function migrateUser(user) {
  const legacyData = user.onboarding?.data || {};

  const employment = pickDefined(legacyData, EMPLOYMENT_KEYS);
  const retirement = pickDefined(legacyData, RETIREMENT_KEYS);
  const completedAt = user.onboarding?.completedAt || null;

  const hasAny = Object.keys(employment).length > 0 || Object.keys(retirement).length > 0;
  if (!hasAny && !completedAt) {
    return { userId: user._id.toString(), skipped: true };
  }

  let profile = await UserProfile.findOne({ user: user._id });
  if (!profile) {
    profile = new UserProfile({ user: user._id });
  }

  profile.employment = { ...(profile.employment?.toObject?.() ?? profile.employment ?? {}), ...employment };
  profile.retirement = { ...(profile.retirement?.toObject?.() ?? profile.retirement ?? {}), ...retirement };

  if (!profile.completedAt && completedAt) {
    profile.completedAt = completedAt;
  }

  await profile.save();
  return {
    userId: user._id.toString(),
    skipped: false,
    employmentFields: Object.keys(employment).length,
    retirementFields: Object.keys(retirement).length,
  };
}

async function runMigration({ connectionString } = {}) {
  const uri = connectionString || process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is required');
  }

  let createdConnection = false;
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(uri);
    createdConnection = true;
  }

  const users = await User.find({}).select('onboarding _id');
  const summary = { total: users.length, migrated: 0, skipped: 0, failures: 0, details: [] };

  for (const user of users) {
    try {
      const result = await migrateUser(user);
      if (result.skipped) {
        summary.skipped += 1;
      } else {
        summary.migrated += 1;
      }
      summary.details.push(result);
    } catch (err) {
      summary.failures += 1;
      summary.details.push({ userId: user._id.toString(), error: err.message });
    }
  }

  if (createdConnection) {
    await mongoose.disconnect();
  }

  return summary;
}

if (require.main === module) {
  runMigration()
    .then(summary => {
      console.log('Migration complete:', JSON.stringify(summary, null, 2));
      process.exit(0);
    })
    .catch(err => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}

module.exports = { runMigration, migrateUser };
